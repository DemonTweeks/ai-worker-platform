<template>
  <section class="panel">
    <h2>Re-Ask PR Worker</h2>
    <textarea
      :value="value"
      rows="4"
      :disabled="!jobId || loading"
      placeholder="Ask for additional context, for example: Why were some sites unmatched?"
      @input="$emit('input', $event.target.value)"
      @keydown="handleKeydown"
    />
    <LoadingButton
      label="Ask"
      loading-text="Asking..."
      :loading="loading"
      :disabled="!jobId || !value.trim()"
      @click="submit"
    />
    <div v-if="answer" class="answer-box">
      <div class="answer-meta">{{ answer.answerSource }} · {{ answer.llmStatus }}</div>
      <p v-if="answer.question" class="question-text">{{ answer.question }}</p>
      <p>{{ answer.answer }}</p>
    </div>
  </section>
</template>

<script>
import LoadingButton from './LoadingButton.vue';

export default {
  name: 'ReAskPanel',
  components: { LoadingButton },
  props: {
    jobId: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    answer: { type: Object, default: null },
    value: { type: String, default: '' }
  },
  methods: {
    handleKeydown(event) {
      if (event.key !== 'Enter' || event.shiftKey) {
        return;
      }

      event.preventDefault();
      this.submit();
    },
    submit() {
      const question = this.value.trim();
      if (!this.jobId || this.loading || !question) {
        return;
      }

      this.$emit('submit-question', { question });
    }
  }
};
</script>
