<template>
  <div class="cockpit-field-group">
    <div v-if="presentation.summaryLabel" class="cockpit-card-heading">
      <span>{{ fieldLabel }}</span>
      <small>{{ itemCount }} {{ presentation.summaryLabel }}</small>
    </div>
    <span v-else class="field-label">
      {{ fieldLabel }}<strong v-if="entry.required"> *</strong>
    </span>

    <div v-if="control === 'segmented'" class="segmented compact-segmented">
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        :class="{ active: value === option.value }"
        :disabled="disabled"
        @click="$emit('input', option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <select
      v-else-if="control === 'select'"
      class="cockpit-sites-input compact-inline-select"
      :value="value"
      :required="entry.required"
      :disabled="disabled"
      @change="$emit('input', coerce($event.target.value))"
    >
      <option v-if="presentation.placeholder" value="">{{ presentation.placeholder }}</option>
      <option v-for="option in options" :key="String(option.value)" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <label v-else-if="entry.rule.type === 'boolean'" class="cockpit-empty-card">
      <input :checked="Boolean(value)" type="checkbox" :disabled="disabled" @change="$emit('input', $event.target.checked)">
      {{ value ? (presentation.enabledLabel || 'Enabled') : (presentation.disabledLabel || 'Disabled') }}
    </label>

    <textarea
      v-else-if="entry.rule.type === 'array' || control === 'textarea'"
      class="cockpit-sites-input"
      :value="value"
      :rows="presentation.rows || 5"
      :placeholder="presentation.placeholder || 'One value per line'"
      :required="entry.required"
      :disabled="disabled"
      @input="$emit('input', $event.target.value)"
    ></textarea>

    <input
      v-else
      class="cockpit-sites-input"
      :value="value"
      :type="entry.rule.type === 'integer' ? 'number' : 'text'"
      :min="entry.rule.minimum"
      :max="entry.rule.maximum"
      :placeholder="presentation.placeholder"
      :required="entry.required"
      :disabled="disabled"
      @input="$emit('input', coerce($event.target.value))"
    >

    <p v-if="presentation.hint" class="field-hint">{{ presentation.hint }}</p>
  </div>
</template>

<script>
const humanize = (value) => String(value)
  .replace(/_/g, ' ')
  .replace(/-/g, ' ')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/^./, (letter) => letter.toUpperCase());

export default {
  name: 'ManifestParameterField',
  props: {
    entry: { type: Object, required: true },
    value: { default: '' },
    disabled: { type: Boolean, default: false }
  },
  computed: {
    presentation() {
      return this.entry.ui || {};
    },
    fieldLabel() {
      return this.presentation.label || humanize(this.entry.name);
    },
    control() {
      if (this.presentation.control) return this.presentation.control;
      if (this.entry.rule.enum) return 'segmented';
      return this.entry.rule.type;
    },
    options() {
      if (Array.isArray(this.presentation.options)) {
        return this.presentation.options.map((option) => (
          option && typeof option === 'object'
            ? option
            : { value: option, label: humanize(option) }
        ));
      }
      if (this.presentation.optionSource === 'months') {
        return Array.from({ length: 12 }, (_, index) => ({
          value: index + 1,
          label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index, 1))
        }));
      }
      if (this.presentation.optionSource === 'years') {
        const current = new Date().getFullYear();
        const start = Number(this.presentation.startOffset ?? -5);
        const end = Number(this.presentation.endOffset ?? 1);
        return Array.from({ length: end - start + 1 }, (_, index) => {
          const year = current + start + index;
          return { value: year, label: String(year) };
        }).reverse();
      }
      return (this.entry.rule.enum || []).map((option) => ({ value: option, label: humanize(option) }));
    },
    itemCount() {
      if (Array.isArray(this.value)) return this.value.length;
      return String(this.value || '').split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean).length;
    }
  },
  methods: {
    coerce(value) {
      if (value === '') return '';
      if (this.entry.rule.type === 'integer') return Number(value);
      return value;
    }
  }
};
</script>
