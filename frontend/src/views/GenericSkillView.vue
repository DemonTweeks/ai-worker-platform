<template>
  <main class="page-shell">
    <section class="panel skill-runner-panel">
      <p class="eyebrow">Standalone Python skill</p>
      <h1>{{ skill ? skill.displayName : 'Loading skill…' }}</h1>
      <p class="muted">The platform validates transport and runs the approved package. Workbook and business validation stay inside the skill.</p>

      <div v-if="loading" class="status-banner">Loading the approved skill contract…</div>
      <div v-else-if="error" class="error-banner">{{ error }}</div>

      <form v-else-if="skill" class="skill-form" @submit.prevent="submit">
        <fieldset>
          <legend>Input files</legend>
          <label v-for="input in skill.inputs.files" :key="input.name" class="skill-field">
            <span>{{ labelFor(input.name) }}<strong v-if="input.required"> *</strong></span>
            <input
              type="file"
              :accept="input.acceptedExtensions.join(',')"
              :multiple="input.multiple"
              :required="input.required"
              @change="selectFiles(input, $event)"
            >
            <small>{{ input.multiple ? 'Select one or more files.' : 'Select one file.' }} Accepted: {{ input.acceptedExtensions.join(', ') }}</small>
          </label>
        </fieldset>

        <fieldset v-if="parameterEntries.length">
          <legend>Parameters</legend>
          <label v-for="entry in parameterEntries" :key="entry.name" class="skill-field">
            <span>{{ labelFor(entry.name) }}<strong v-if="entry.required"> *</strong></span>
            <select v-if="entry.rule.enum" v-model="parameterValues[entry.name]" :required="entry.required">
              <option v-for="option in entry.rule.enum" :key="option" :value="option">{{ option }}</option>
            </select>
            <input v-else-if="entry.rule.type === 'boolean'" v-model="parameterValues[entry.name]" type="checkbox">
            <textarea v-else-if="entry.rule.type === 'array'" v-model="parameterValues[entry.name]" rows="3" placeholder="One value per line"></textarea>
            <input
              v-else
              v-model="parameterValues[entry.name]"
              :type="entry.rule.type === 'integer' ? 'number' : 'text'"
              :min="entry.rule.minimum"
              :max="entry.rule.maximum"
              :required="entry.required"
            >
          </label>
        </fieldset>

        <button type="submit" :disabled="submitting">{{ submitting ? 'Submitting…' : 'Start skill job' }}</button>
      </form>
    </section>
  </main>
</template>

<script>
import { createSkillJob, getErrorMessage, listSkills } from '../api/jobApi';

const randomId = (prefix) => {
  const random = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
};

export default {
  name: 'GenericSkillView',
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
      parameterValues: {},
      browserTabSessionId: randomId('skill-tab')
    };
  },
  computed: {
    parameterEntries() {
      if (!this.skill) return [];
      const schema = this.skill.inputs.parametersSchema || {};
      const required = new Set(schema.required || []);
      return Object.entries(schema.properties || {}).map(([name, rule]) => ({ name, rule, required: required.has(name) }));
    }
  },
  watch: {
    skillId: 'loadSkill'
  },
  mounted() {
    this.loadSkill();
  },
  methods: {
    labelFor(value) {
      return String(value).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
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

<style scoped>
.skill-runner-panel { max-width: 880px; margin: 0 auto; }
.skill-form, fieldset { display: grid; gap: 1rem; }
fieldset { margin: 1.5rem 0 0; padding: 1.25rem; border: 1px solid var(--border-color, #d8dee8); border-radius: 12px; }
.skill-field { display: grid; gap: 0.45rem; }
.skill-field input:not([type='checkbox']), .skill-field select, .skill-field textarea { width: 100%; box-sizing: border-box; padding: 0.7rem; }
.skill-field small, .muted { color: #64748b; }
.error-banner { margin: 1rem 0; color: #9f1239; }
button { justify-self: start; margin-top: 1.25rem; padding: 0.75rem 1.2rem; }
</style>
