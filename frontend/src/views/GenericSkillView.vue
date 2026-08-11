<template>
  <div class="home-cockpit">
    <ErrorBanner
      :message="error"
      :dismissible="Boolean(error)"
      @dismiss="error = ''"
    />

    <section class="workbench-hero" :aria-label="`${skillDisplayName} workbench`">
      <div class="workbench-hero-copy">
        <p class="workbench-kicker">ZTE AI Worker</p>
        <h2>{{ heroTitle }}</h2>
        <p class="workbench-subtitle">{{ heroSubtitle }}</p>

        <div class="workbench-chip-row" aria-label="Workflow status">
          <span class="workbench-chip">{{ skillDisplayName }}</span>
          <span class="workbench-chip">Approved package</span>
          <span class="workbench-chip">Standalone Python</span>
          <span class="workbench-chip">{{ statusLabel }}</span>
        </div>

        <div class="workbench-action-row" aria-label="Primary actions">
          <a class="workbench-primary-link" href="#worker-workbench" @click.prevent="scrollToWorkbench">Configure Job</a>
          <router-link class="workbench-secondary-link" to="/history">View Job History</router-link>
        </div>
      </div>

      <section id="worker-workbench" ref="workbench" class="workbench-surface" :aria-label="`${skillDisplayName} workflow`">
        <div class="workbench-surface-header">
          <div>
            <p class="eyebrow">Operational Workflow</p>
            <h3>{{ skillDisplayName }}</h3>
          </div>
          <span class="workbench-status-pill">{{ statusLabel }}</span>
        </div>

        <div v-if="loading" class="status-banner">Loading the approved skill contract...</div>

        <form v-else-if="skill" class="workbench-form" @submit.prevent="submit">
          <div class="workbench-main-grid">
            <div class="workbench-upload-stack">
              <section
                v-for="input in skill.inputs.files"
                :key="input.name"
                class="panel cockpit-card upload-card workbench-upload-card"
              >
                <div class="panel-heading">
                  <h2 class="upload-validate">{{ uploadTitle(input.name) }}</h2>
                </div>

                <div v-if="!hasSelectedFile(input.name)">
                  <label class="field-label" :for="inputId(input.name)">
                    {{ labelFor(input.name) }}<strong v-if="input.required"> *</strong>
                  </label>
                  <p class="field-hint">
                    {{ input.multiple ? 'Select one or more source files.' : 'Select the source file.' }}
                    Accepted: {{ input.acceptedExtensions.join(', ') }}
                  </p>
                  <input
                    :id="inputId(input.name)"
                    :key="`${input.name}-${inputResetKeys[input.name] || 0}`"
                    class="upload-input"
                    type="file"
                    :accept="input.acceptedExtensions.join(',')"
                    :multiple="input.multiple"
                    :required="input.required"
                    :disabled="submitting"
                    @change="selectFiles(input, $event)"
                  >
                </div>

                <div v-else class="file-state">
                  <span class="meta-label">Selected file{{ input.multiple ? 's' : '' }}</span>
                  <strong class="file-state-name">{{ selectedFileLabel(input.name) }}</strong>
                  <div class="workbench-action-row file-state-actions">
                    <button type="button" class="tertiary-action" :disabled="submitting" @click="clearFiles(input.name)">
                      Remove
                    </button>
                  </div>
                </div>

                <p v-if="!hasSelectedFile(input.name)" class="muted">
                  Upload is not started. Validation runs inside the approved skill after submission.
                </p>
              </section>
            </div>

            <section class="panel cockpit-card workbench-config-card">
              <div class="cockpit-card-heading">
                <span>Launch Configuration</span>
                <small>Manifest-defined</small>
              </div>

              <div v-if="parameterEntries.length" class="workbench-config-grid">
                <div v-for="entry in parameterEntries" :key="entry.name" class="cockpit-field-group">
                  <span class="field-label">
                    {{ labelFor(entry.name) }}<strong v-if="entry.required"> *</strong>
                  </span>

                  <div v-if="entry.rule.enum" class="segmented compact-segmented">
                    <button
                      v-for="option in entry.rule.enum"
                      :key="option"
                      type="button"
                      :class="{ active: parameterValues[entry.name] === option }"
                      :disabled="submitting"
                      @click="$set(parameterValues, entry.name, option)"
                    >
                      {{ labelFor(option) }}
                    </button>
                  </div>

                  <label v-else-if="entry.rule.type === 'boolean'" class="cockpit-empty-card">
                    <input v-model="parameterValues[entry.name]" type="checkbox" :disabled="submitting">
                    {{ parameterValues[entry.name] ? 'Enabled' : 'Disabled' }}
                  </label>

                  <textarea
                    v-else-if="entry.rule.type === 'array'"
                    v-model="parameterValues[entry.name]"
                    class="cockpit-sites-input"
                    rows="5"
                    placeholder="One value per line"
                    :required="entry.required"
                    :disabled="submitting"
                  ></textarea>

                  <input
                    v-else
                    v-model="parameterValues[entry.name]"
                    class="cockpit-sites-input"
                    :type="entry.rule.type === 'integer' ? 'number' : 'text'"
                    :min="entry.rule.minimum"
                    :max="entry.rule.maximum"
                    :required="entry.required"
                    :disabled="submitting"
                  >
                </div>
              </div>

              <div v-else class="cockpit-empty-card">
                This package does not require launch parameters.
              </div>

              <div class="cockpit-empty-card">
                The platform transports these inputs without interpreting workbook or business content.
              </div>

              <div class="workbench-create-row">
                <button type="submit" class="action-button" :disabled="submitting || !canSubmit">
                  {{ submitting ? 'Creating...' : 'Create Job' }}
                </button>
                <p v-if="!canSubmit" class="cockpit-note">Select every required input before creating the Job.</p>
                <p v-else class="cockpit-ready">Ready to create Job</p>
              </div>
            </section>
          </div>

          <section class="panel cockpit-card workbench-result-card">
            <div class="cockpit-card-heading">
              <span>Execution Handoff</span>
              <small>Thin wrapper</small>
            </div>
            <div class="cockpit-empty-card">
              The server validates the package contract, queues the request, and starts its Python entrypoint. The skill owns technical validation, business rules, and output generation.
            </div>
          </section>
        </form>
      </section>
    </section>
  </div>
</template>

<script>
import ErrorBanner from '../components/ErrorBanner.vue';
import { createSkillJob, getErrorMessage, listSkills } from '../api/jobApi';

const randomId = (prefix) => {
  const random = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};

const HERO_CONTENT = {
  'create-pr-cd': {
    title: 'Launch PR Creator jobs with controlled source inputs.',
    subtitle: 'Configure the approved MW PR skill, submit its source workbook, and continue to dedicated Job progress and result delivery.'
  },
  'create-pr-cd-ran': {
    title: 'Launch PR Creator jobs for RAN workflows.',
    subtitle: 'Submit BOM and EPMS inputs to the approved RAN package while its Python runtime owns project validation, calculation, and workbook generation.'
  },
  'tx-pr-auditor': {
    title: 'Run controlled PR audits from approved inputs.',
    subtitle: 'Submit Final PO and expected ECC workbooks to the standalone auditor, then review progress and evidence through the shared Job workflow.'
  }
};

const UPLOAD_TITLES = {
  site_data: 'Source Data Upload',
  bom: 'BOM Upload',
  epms: 'EPMS Upload',
  final_po: 'Final PO Upload',
  expected_ecc: 'Expected ECC Upload'
};

export default {
  name: 'GenericSkillView',
  components: { ErrorBanner },
  props: {
    skillId: { type: String, required: true }
  },
  data() {
    return {
      skill: null,
      loading: true,
      submitting: false,
      error: '',
      selectedFiles: {},
      inputResetKeys: {},
      parameterValues: {},
      browserTabSessionId: randomId('skill-tab')
    };
  },
  computed: {
    skillDisplayName() {
      return this.skill ? this.skill.displayName : 'Loading skill...';
    },
    heroTitle() {
      return HERO_CONTENT[this.skillId]?.title || `Launch ${this.skillDisplayName} jobs.`;
    },
    heroSubtitle() {
      return HERO_CONTENT[this.skillId]?.subtitle || 'Submit approved inputs through the shared Job workflow.';
    },
    statusLabel() {
      if (this.loading) return 'Loading';
      if (this.error) return 'Unavailable';
      if (this.submitting) return 'Creating';
      return 'Ready';
    },
    parameterEntries() {
      if (!this.skill) return [];
      const schema = this.skill.inputs.parametersSchema || {};
      const required = new Set(schema.required || []);
      return Object.entries(schema.properties || {}).map(([name, rule]) => ({ name, rule, required: required.has(name) }));
    },
    canSubmit() {
      if (!this.skill) return false;
      return this.skill.inputs.files.every((input) => !input.required || this.hasSelectedFile(input.name));
    }
  },
  watch: {
    skillId: 'loadSkill'
  },
  mounted() {
    this.loadSkill();
  },
  methods: {
    scrollToWorkbench() {
      if (this.$refs.workbench && typeof this.$refs.workbench.scrollIntoView === 'function') {
        this.$refs.workbench.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    labelFor(value) {
      return String(value).replace(/_/g, ' ').replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
    },
    uploadTitle(name) {
      return UPLOAD_TITLES[name] || `${this.labelFor(name)} Upload`;
    },
    inputId(name) {
      return `skill-input-${this.skillId}-${name}`;
    },
    hasSelectedFile(name) {
      const selected = this.selectedFiles[name];
      return Array.isArray(selected) ? selected.length > 0 : Boolean(selected);
    },
    selectedFileLabel(name) {
      const selected = this.selectedFiles[name];
      const values = Array.isArray(selected) ? selected : [selected];
      return values.filter(Boolean).map((file) => file.name).join(', ');
    },
    clearFiles(name) {
      this.$set(this.selectedFiles, name, null);
      this.$set(this.inputResetKeys, name, (this.inputResetKeys[name] || 0) + 1);
    },
    async loadSkill() {
      this.loading = true;
      this.error = '';
      try {
        const catalog = await listSkills();
        this.skill = catalog.skills.find((item) => item.skillId === this.skillId) || null;
        if (!this.skill) throw new Error('The requested skill is not approved on this server.');
        const schema = this.skill.inputs.parametersSchema || {};
        const values = {};
        Object.entries(schema.properties || {}).forEach(([name, rule]) => {
          if (rule.default !== undefined) values[name] = rule.default;
          else if (rule.enum) values[name] = rule.enum[0];
          else if (rule.type === 'boolean') values[name] = false;
          else values[name] = '';
        });
        this.parameterValues = values;
        this.selectedFiles = {};
        this.inputResetKeys = {};
      } catch (error) {
        this.error = getErrorMessage(error);
      } finally {
        this.loading = false;
      }
    },
    selectFiles(input, event) {
      const files = Array.from(event.target.files || []);
      this.$set(this.selectedFiles, input.name, input.multiple ? files : files[0] || null);
    },
    normalizedParameters() {
      const result = {};
      for (const entry of this.parameterEntries) {
        const value = this.parameterValues[entry.name];
        if (entry.rule.type === 'array') {
          const values = String(value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean);
          if (values.length || entry.required) result[entry.name] = values;
        } else if (entry.rule.type === 'integer') {
          if (value !== '' && value !== null) result[entry.name] = Number(value);
        } else if (value !== '' && value !== undefined) {
          result[entry.name] = value;
        }
      }
      return result;
    },
    async submit() {
      if (!this.canSubmit) return;
      this.submitting = true;
      this.error = '';
      try {
        const result = await createSkillJob(this.skillId, {
          files: this.selectedFiles,
          parameters: this.normalizedParameters(),
          browserTabSessionId: this.browserTabSessionId,
          idempotencyKey: randomId(`skill-${this.skillId}`)
        });
        await this.$router.push({ name: 'job-detail', params: { jobId: result.job.jobId } });
      } catch (error) {
        this.error = getErrorMessage(error);
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>
