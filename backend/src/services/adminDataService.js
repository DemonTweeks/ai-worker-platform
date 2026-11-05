const crypto = require('crypto');
const path = require('path');
const config = require('../config/env');
const { getSqlite } = require('../db/databaseClient');
const tree = require('../db/jsonTree');
const { createApiError } = require('../utils/apiError');
const COLLECTIONS = ['jobs','job_files','warning_items','review_required_items','assets','admin_users','admin_audit_logs','local_settings','admin_data_notes'];
const WRITABLE = new Set(['local_settings','admin_data_notes']);
const SENSITIVE = /password|secret|token|authorization|cookie|credential|api.?key|private.?key|jwt|(^|_)(absolute.?path|storage.?root|workspace.?root)$/i;
const MAX_BYTES = 64*1024;
const error = (code,message,status=400) => { throw createApiError(status,code,message); };
const store = () => {
  if(config.dbProvider !== 'sqlite') error('SQLITE_REQUIRED','Data Management is available only in SQLite mode.',409);
  return getSqlite();
};
const collection = (value) => { if(!COLLECTIONS.includes(value)) error('INVALID_COLLECTION','Collection is not available.'); return value; };
const key = (value) => { if(typeof value!=='string' || !value || value.length>300) error('INVALID_RECORD_KEY','Invalid record key.'); tree.parts(value); return value; };
const recordKey = (name,value) => {
  key(value);
  const segments=tree.parts(value), expected=['job_files','warning_items','review_required_items'].includes(name)?2:1;
  if(segments.length!==expected||segments.join('/')!==value) error('INVALID_RECORD_KEY','Expected an exact record key, not a nested JSON path.');
  return value;
};
const redact = (value) => {
  if(Array.isArray(value)) return value.map(redact);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,SENSITIVE.test(k)?'[REDACTED]':redact(v)]));
  return value;
};
const sizeCheck = value => { if(Buffer.byteLength(JSON.stringify(value))>MAX_BYTES) error('DATA_TOO_LARGE','Data request exceeds 64 KiB.',413); };
const boundedText = (value,max,required=false) => {
  if(typeof value !== 'string' || value.length>max || (required && !value.trim())) error('INVALID_DOCUMENT','Invalid text field.');
};
const validateEditable = (name,document) => {
  if(!WRITABLE.has(name)) error('PROTECTED_COLLECTION','Execution records, credentials, audit logs and worker-owned assets cannot be edited here.',403);
  tree.validate(document); sizeCheck(document);
  if(!document || typeof document!=='object' || Array.isArray(document)) error('INVALID_DOCUMENT','Document must be an object.');
  const allowed = name==='local_settings'?['label','description','value']:['targetCollection','targetKey','title','notes','tags'];
  if(Object.keys(document).some(field=>!allowed.includes(field))) error('PROTECTED_FIELD','Document contains unsupported fields.');
  if(name==='local_settings') {
    boundedText(document.label,120,true); boundedText(document.description,2000);
    if(!Object.hasOwn(document,'value')) error('INVALID_DOCUMENT','A JSON value is required.');
    const check = value => {
      if(value && typeof value==='object') for(const [k,v] of Object.entries(value)) {
        if(SENSITIVE.test(k)) error('SECRET_NOT_ALLOWED','Do not store credentials or secrets in local settings.'); check(v);
      }
    }; check(document.value);
  } else {
    collection(document.targetCollection); recordKey(document.targetCollection,document.targetKey);
    boundedText(document.title,120); boundedText(document.notes,4000);
    if(!Array.isArray(document.tags)||document.tags.length>20||document.tags.some(v=>typeof v!=='string'||v.length>60)) error('INVALID_DOCUMENT','Tags must be up to 20 short strings.');
  }
  return document;
};
const noteKey = (name,id) => crypto.createHash('sha256').update(`${name}/${id}`).digest('hex');
const audit = (db,actor,action,metadata={}) => {
  const id=`data_${crypto.randomUUID()}`;
  db.write(`admin_audit_logs/${id}`,{_id:id,admin:actor,action,status:'success',timestamp:new Date().toISOString(),metadata});
};
const revision = (db,name,id) => db.db.prepare('SELECT revision FROM documents WHERE path=?').get(`${name}/${id}`)?.revision || 0;
const assertRevision = (expected,actual) => {
  if(!Number.isSafeInteger(expected)||expected<0) error('REVISION_REQUIRED','A numeric expectedRevision is required.');
  if(expected!==actual) error('STALE_RECORD','Record changed. Reload and review before saving.',409);
};
const summary = () => {
  const db=store(), info=db.info();
  return {...info,collections:COLLECTIONS.map(name=>({name,count:info.collections.find(v=>v.collection===name)?.count||0,editable:WRITABLE.has(name)})),
    editableCollections:[...WRITABLE],importCollections:['local_settings'],notes:'Local settings are admin-managed JSON, not active worker/runtime configuration. Do not enter secrets.'};
};
const list = (name,query={}) => {
  collection(name);
  const positive = (value,fallback,max) => { const n=Number(value??fallback); if(!Number.isSafeInteger(n)||n<1||n>max) error('INVALID_PAGINATION','Invalid page or limit.'); return n; };
  const page=positive(query.page,1,100000),limit=positive(query.limit,25,100);
  for(const field of ['search','status','workerId','scope']) if(query[field]!==undefined&&(typeof query[field]!=='string'||query[field].length>200)) error('INVALID_FILTER','Invalid search filter.');
  const result=store().list(name,{page,limit,search:query.search,status:query.status,workerId:query.workerId,scope:query.scope});
  // List only identities and common scalar fields; load full JSON on demand.
  return {...result,items:result.items.map(row=>({key:row.key,revision:row.revision,status:row.document.status||'',workerId:row.document.workerId||'',scope:row.document.prScope||'',label:row.document.label||row.document.title||''}))};
};
const detail = (name,id) => {
  collection(name);recordKey(name,id);
  const db=store(),document=db.read(`${name}/${id}`);
  if(document===null) error('RECORD_NOT_FOUND','Record not found.',404);
  const nk=noteKey(name,id);
  return {collection:name,key:id,document:redact(document),revision:revision(db,name,id),editable:WRITABLE.has(name),
    annotation:{key:nk,revision:revision(db,'admin_data_notes',nk),document:db.read(`admin_data_notes/${nk}`)||{targetCollection:name,targetKey:id,title:'',notes:'',tags:[]}}};
};
const save = (name,id,body,actor) => {
  collection(name);recordKey(name,id);sizeCheck(body);validateEditable(name,body.document);
  if(id.includes('/')) error('INVALID_RECORD_KEY','Editable record keys cannot contain slash.');
  const db=store();
  db.atomic(()=>{
    assertRevision(body.expectedRevision,revision(db,name,id));
    if(name==='admin_data_notes') {
      const d=body.document;
      if(id!==noteKey(d.targetCollection,d.targetKey)||db.read(`${d.targetCollection}/${d.targetKey}`)===null) error('INVALID_ANNOTATION','Annotation target is invalid.');
    }
    const before=db.read(`${name}/${id}`);
    db.write(`${name}/${id}`,body.document);
    audit(db,actor,'DATA_EDIT',{collection:name,key:id,changedFields:Object.keys(body.document).filter(k=>JSON.stringify(before?.[k])!==JSON.stringify(body.document[k]))});
  });
  return detail(name,id);
};
const exportCollection = (name,query,actor) => {
  collection(name);
  const db=store();
  return db.atomic(()=>{
    const selected=list(name,query);
    const records=selected.items.map(item=>({key:item.key,document:redact(db.read(`${name}/${item.key}`))}));
    const bundle={format:'platform-data-view',schemaVersion:1,redacted:true,migrationBackup:false,collection:name,exportedAt:new Date().toISOString(),page:selected.page,total:selected.total,records};
    if(Buffer.byteLength(JSON.stringify(bundle))>2*1024*1024) error('EXPORT_TOO_LARGE','Export exceeds 2 MiB. Select a smaller page.',413);
    audit(db,actor,'DATA_EXPORT',{collection:name,count:records.length,redacted:true});
    return bundle;
  });
};
const inspectImport = bundle => {
  sizeCheck(bundle);
  if(!bundle||bundle.format!=='platform-settings-import'||bundle.schemaVersion!==1||bundle.collection!=='local_settings'||!Array.isArray(bundle.records)||bundle.records.length<1||bundle.records.length>100) {
    error('INVALID_IMPORT','Expected platform-settings-import schema 1, collection local_settings and 1-100 records. Redacted exports are not import backups.');
  }
  const ids=new Set();
  for(const record of bundle.records) {
    key(record.key);
    if(record.key.includes('/')||ids.has(record.key)) error('INVALID_IMPORT','Record keys must be unique and cannot contain slash.');
    ids.add(record.key);validateEditable('local_settings',record.document);
    if(!Number.isSafeInteger(record.expectedRevision)||record.expectedRevision<0) error('REVISION_REQUIRED','Each import record requires expectedRevision (0 for a new key).');
  }
};
const previewImport = (bundle,actor) => {
  inspectImport(bundle);const db=store();
  return db.atomic(()=>{
    const records=bundle.records.map(record=>({key:record.key,action:revision(db,'local_settings',record.key)?'update':'insert',expectedRevision:record.expectedRevision,currentRevision:revision(db,'local_settings',record.key),document:record.document}));
    const conflicts=records.filter(v=>v.expectedRevision!==v.currentRevision).map(v=>v.key);
    const baseRevision=db.revision();
    const digest=crypto.createHash('sha256').update(JSON.stringify({bundle,baseRevision})).digest('hex');
    // Stateless preview token bound to actor, exact bundle and database revision, expiring in ten minutes.
    if(!config.admin.jwtSecret) error('JWT_SECRET_NOT_CONFIGURED','JWT secret is required.',503);
    const token=require('jsonwebtoken').sign({purpose:'settings-import',actor,digest,baseRevision},config.admin.jwtSecret,{expiresIn:'10m'});
    return {records,conflicts,canApply:conflicts.length===0,previewToken:token};
  });
};
const applyImport = (body,actor) => {
  inspectImport(body.bundle);
  if(body.confirmation!=='APPLY SETTINGS IMPORT') error('CONFIRMATION_REQUIRED','Type APPLY SETTINGS IMPORT to confirm.');
  let token;
  try {token=require('jsonwebtoken').verify(body.previewToken,config.admin.jwtSecret);} catch(_){error('INVALID_PREVIEW','Preview expired or invalid. Preview again.',409);}
  const db=store();
  if(token.purpose!=='settings-import'||token.actor!==actor) error('INVALID_PREVIEW','Preview does not belong to this admin.',409);
  const digest=crypto.createHash('sha256').update(JSON.stringify({bundle:body.bundle,baseRevision:token.baseRevision})).digest('hex');
  if(digest!==token.digest) error('INVALID_PREVIEW','Import changed since preview.',409);
  if(db.revision()!==token.baseRevision) error('STALE_IMPORT','Database changed. Preview the import again.',409);
  const backup=db.backup(path.join(path.dirname(db.filename),'backups',`before-settings-import-${crypto.randomUUID()}.db`));
  db.atomic(()=>{
    if(db.revision()!==token.baseRevision) error('STALE_IMPORT','Database changed. Preview again.',409);
    for(const record of body.bundle.records) assertRevision(record.expectedRevision,revision(db,'local_settings',record.key));
    for(const record of body.bundle.records) db.write(`local_settings/${record.key}`,record.document);
    audit(db,actor,'DATA_IMPORT',{collection:'local_settings',count:body.bundle.records.length,backupCreated:true});
  });
  return {applied:body.bundle.records.length,backupCreated:true,backupFile:path.basename(backup)};
};
module.exports={summary,list,detail,save,exportCollection,previewImport,applyImport,redact,validateEditable};
