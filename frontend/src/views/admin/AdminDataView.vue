<template>
  <div class="portal-shell data-console">
    <section class="page-title-bar"><div><p class="page-eyebrow">Administration</p><h2>Data Management</h2></div><button :disabled="busy" @click="refresh">Refresh</button></section>
    <ErrorBanner :message="errorMessage" />
    <p v-if="message" role="status">{{ message }}</p>
    <section v-if="summary" class="panel">
      <p><strong>{{ summary.provider }}</strong> Â· Schema {{ summary.schemaVersion }} Â· Database {{ summary.sizeBytes }} bytes Â· WAL {{ summary.walBytes }} bytes</p>
      <p>Last backup: {{ summary.lastBackupAt || 'Not yet backed up' }}</p>
      <p class="helper-text">{{ summary.notes }} Credentials and execution fields are protected. Every edit and export is audited.</p>
      <label>Collection <select v-model="collection" :disabled="busy" @change="changeCollection"><option v-for="c in summary.collections" :key="c.name" :value="c.name">{{ c.name }} ({{ c.count }}){{ c.editable ? ' â€” editable' : '' }}</option></select></label>
      <form class="data-filters" @submit.prevent="searchRecords">
        <label>Record key <input v-model="search" maxlength="200" /></label><label>Status <input v-model="status" maxlength="100" /></label><label>Worker <input v-model="workerId" maxlength="100" /></label><label>Scope <input v-model="scope" maxlength="100" /></label>
        <button :disabled="busy">Search</button><button type="button" :disabled="busy" @click="exportPage">Export this page</button>
      </form>
      <p>Export is redacted and is not a lossless migration backup.</p>
      <table><thead><tr><th>Key</th><th>Status / label</th><th>Worker / scope</th><th></th></tr></thead><tbody><tr v-for="item in items" :key="item.key"><td>{{ item.key }}</td><td>{{ item.status || item.label }}</td><td>{{ item.workerId }} {{ item.scope }}</td><td><button :disabled="busy" @click="openRecord(item.key)">View</button></td></tr></tbody></table>
      <p v-if="!items.length">No records.</p>
      <div class="data-filters"><button :disabled="busy || page <= 1" @click="movePage(-1)">Previous</button><span>Page {{ page }} Â· {{ total }} records</span><button :disabled="busy || page * 25 >= total" @click="movePage(1)">Next</button></div>
      <button v-if="collection === 'local_settings'" :disabled="busy" @click="newSetting">New local setting</button>
    </section>
    <section v-if="selected" class="panel">
      <h3>{{ selected.collection }}/{{ selected.key }}</h3><p>Revision {{ selected.revision }} Â· Secrets redacted</p>
      <pre class="data-json">{{ pretty(selected.document) }}</pre>
      <p v-if="!selected.editable">Execution data is read-only. You can add an annotation without changing the original record.</p>
      <button :disabled="busy" @click="beginEdit">{{ selected.editable ? 'Edit JSON' : 'Edit annotation' }}</button>
    </section>
    <section v-if="editor" class="panel">
      <h3>Edit {{ editor.collection }}/{{ editor.key }}</h3>
      <p>Local settings store admin-managed data only; they do not override runtime or skill configuration. Do not enter secrets.</p>
      <label v-if="editor.isNew">New key <input v-model="editor.key" maxlength="120" /></label>
      <label>JSON document<textarea v-model="editorText" rows="12" spellcheck="false" @input="editPreview = null; editConfirmed = false"></textarea></label>
      <button :disabled="busy" @click="previewEdit">Preview changes</button>
      <div v-if="editPreview"><h4>Before</h4><pre class="data-json">{{ pretty(editor.before) }}</pre><h4>After</h4><pre class="data-json">{{ pretty(editPreview) }}</pre><label><input v-model="editConfirmed" type="checkbox" /> I reviewed these changes.</label><button :disabled="busy || !editConfirmed" @click="saveEdit">Save audited edit</button></div>
      <button :disabled="busy" @click="editor = null">Cancel</button>
    </section>
    <section v-if="summary" class="panel">
      <h3>Import local settings JSON</h3>
      <p>Only local_settings are importable online. Maximum 64 KiB and 100 records. The full private migration tool is offline-only.</p>
      <details><summary>Import format example</summary><pre class="data-json">{{ pretty(importExample) }}</pre></details>
      <label>Import JSON<textarea v-model="importText" rows="10" spellcheck="false" @input="invalidateImport"></textarea></label>
      <button :disabled="busy || !importText" @click="previewImport">Validate and preview</button>
      <div v-if="importPreview"><pre class="data-json">{{ pretty({ records: importPreview.records, conflicts: importPreview.conflicts }) }}</pre>
        <label>Type APPLY SETTINGS IMPORT <input v-model="importConfirmation" /></label>
        <p>A consistent database backup is created before apply. Conflicts or database changes require a fresh preview.</p>
        <button :disabled="busy || !importPreview.canApply || importConfirmation !== 'APPLY SETTINGS IMPORT'" @click="applyImport">Back up and apply import</button>
      </div>
    </section>
  </div>
</template>
<script>
import ErrorBanner from '../../components/ErrorBanner.vue';
import {getDataSummary,listDataRecords,getDataRecord,saveDataRecord,exportDataRecords,previewDataImport,applyDataImport,getAdminErrorMessage} from '../../api/adminApi';
export default {
  name:'AdminDataView',components:{ErrorBanner},
  data:()=>({summary:null,collection:'jobs',items:[],page:1,total:0,search:'',status:'',workerId:'',scope:'',busy:false,errorMessage:'',message:'',selected:null,editor:null,editorText:'',editPreview:null,editConfirmed:false,importText:'',importPreview:null,importBundle:null,importConfirmation:'',
    importExample:{format:'platform-settings-import',schemaVersion:1,collection:'local_settings',records:[{key:'example',expectedRevision:0,document:{label:'Example',description:'Admin note, not live runtime configuration',value:{enabled:true}}}]}}),
  mounted(){this.refresh();},
  methods:{
    pretty(value){return JSON.stringify(value,null,2);},
    async run(operation){if(this.busy)return;this.busy=true;this.errorMessage='';this.message='';try{await operation();}catch(error){this.errorMessage=getAdminErrorMessage(error);}finally{this.busy=false;}},
    params(){return {page:this.page,limit:25,search:this.search,status:this.status,workerId:this.workerId,scope:this.scope};},
    async load(){const result=await listDataRecords(this.collection,this.params());this.items=result.items;this.total=result.total;},
    refresh(){return this.run(async()=>{this.summary=await getDataSummary();await this.load();});},
    changeCollection(){this.page=1;this.selected=null;this.editor=null;return this.run(()=>this.load());},
    searchRecords(){this.page=1;return this.run(()=>this.load());},
    movePage(delta){this.page+=delta;return this.run(()=>this.load());},
    openRecord(key){return this.run(async()=>{this.editor=null;this.selected=await getDataRecord(this.collection,key);});},
    newSetting(){this.selected=null;this.editor={collection:'local_settings',key:'',revision:0,before:null,isNew:true};this.editorText=this.pretty({label:'',description:'',value:{}});this.editPreview=null;this.editConfirmed=false;},
    beginEdit(){const s=this.selected,n=s.annotation;this.editor=s.editable?{collection:s.collection,key:s.key,revision:s.revision,before:s.document}:{collection:'admin_data_notes',key:n.key,revision:n.revision,before:n.document};this.editorText=this.pretty(this.editor.before);this.editPreview=null;this.editConfirmed=false;},
    previewEdit(){try{this.errorMessage='';this.editPreview=JSON.parse(this.editorText);this.editConfirmed=false;}catch(_){this.errorMessage='Invalid JSON. Correct it before saving.';}},
    saveEdit(){return this.run(async()=>{if(!this.editConfirmed||!this.editPreview)throw new Error('Preview and confirm first.');await saveDataRecord(this.editor.collection,this.editor.key,this.editPreview,this.editor.revision);this.editor=null;this.selected=null;this.summary=await getDataSummary();await this.load();this.message='Edit saved and audited.';});},
    exportPage(){return this.run(async()=>{const bundle=await exportDataRecords(this.collection,this.params());const url=URL.createObjectURL(new Blob([this.pretty(bundle)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${this.collection}-page-${this.page}-redacted.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.message='Redacted export downloaded. Keep it private.';});},
    invalidateImport(){this.importPreview=null;this.importBundle=null;this.importConfirmation='';},
    previewImport(){return this.run(async()=>{this.invalidateImport();this.importBundle=JSON.parse(this.importText);this.importPreview=await previewDataImport(this.importBundle);});},
    applyImport(){return this.run(async()=>{if(!this.importPreview||!this.importPreview.canApply||this.importConfirmation!=='APPLY SETTINGS IMPORT')throw new Error('Preview and confirm first.');const result=await applyDataImport({bundle:this.importBundle,previewToken:this.importPreview.previewToken,confirmation:this.importConfirmation});this.invalidateImport();this.summary=await getDataSummary();await this.load();this.message=`Imported ${result.applied} settings. Backup: ${result.backupFile}`;});}
  }
};
</script>
<style scoped>
.data-console .panel {margin-bottom:18px;padding:18px;}
.data-filters {display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:14px 0;}
.data-console label {display:block;margin:8px 0;}
.data-console textarea {display:block;width:100%;font-family:monospace;box-sizing:border-box;}
.data-json {white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto;background:#f2f5f8;color:#18212d;padding:12px;}
.data-console table {width:100%;text-align:left;overflow-wrap:anywhere;}
.data-console button {margin:4px;padding:7px 12px;}
</style>
