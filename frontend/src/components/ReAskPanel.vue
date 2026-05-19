<template>
  <section class="panel">
    <h2>Re-Ask PR Worker</h2>
    <textarea
      v-model="question"
      rows="4"
      :disabled="!jobId || loading"
      placeholder="Why were some sites unmatched?"
    />
    <LoadingButton
      label="Ask"
      loading-text="Asking..."
      :loading="loading"
      :disabled="!jobId || !question.trim()"
      @click="submit"
    />
    <div v-if="answer" class="answer-box">
      <div class="answer-meta">{{ answer.answerSource }} · {{ answer.llmStatus }}</div>
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
    answer: { type: Object, default: null }
  },
  data() {
    return {
      question: ''
    };
  },
  methods: {
    submit() {
      this.$emit('ask', this.question);
    }
  }
};
</script>
