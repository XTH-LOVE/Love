<script setup lang="ts">
import { ChevronDown, Heart, LoaderCircle, MessageCircleHeart, Sparkles } from '@lucide/vue'

const { profile } = useCoupleAuth()
const { todayQuestion, recentQuestions, loading, busy, error, load, submitAnswer } = useDailyQuestions()

const answerInput = ref('')
const showHistory = ref(false)
const revealPartner = ref(false)

const canSubmit = computed(() => answerInput.value.trim().length > 0 && !busy.value)
const partnerAnswered = computed(() => todayQuestion.value?.partnerAnswer != null)
const myAnswered = computed(() => todayQuestion.value?.myAnswer != null)

async function handleSubmit() {
  if (!canSubmit.value) return
  await submitAnswer(answerInput.value)
  answerInput.value = ''
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

onMounted(() => { load() })
</script>

<template>
  <section class="daily-q-widget panel" aria-label="每日问答">
    <div class="daily-q-header">
      <div>
        <p class="eyebrow">QUESTION OF THE DAY</p>
        <h3>今天的问题</h3>
      </div>
      <MessageCircleHeart :size="18" />
    </div>

    <div v-if="todayQuestion" class="daily-q-main">
      <div class="daily-q-card">
        <Sparkles :size="14" class="daily-q-sparkle" />
        <p class="daily-q-text">{{ todayQuestion.questionText }}</p>
        <p class="daily-q-date">{{ formatDate(todayQuestion.questionDate) }}</p>
      </div>

      <!-- My Answer -->
      <div class="daily-q-answer my-answer">
        <div class="answer-header">
          <span class="answer-who">我的回答</span>
          <span v-if="myAnswered" class="answer-badge done">已回答</span>
        </div>
        <div v-if="myAnswered" class="answer-content">
          <p class="answer-text">{{ todayQuestion.myAnswer?.answerText }}</p>
        </div>
        <div v-else class="answer-form">
          <textarea
            v-model="answerInput"
            maxlength="500"
            placeholder="写下你的回答..."
            class="answer-input"
            rows="3"
          />
          <button type="button" class="answer-submit" :disabled="!canSubmit" @click="handleSubmit">
            <LoaderCircle v-if="busy" class="spin" :size="14" />
            <Heart v-else :size="14" />
            {{ busy ? '提交中...' : '提交回答' }}
          </button>
        </div>
      </div>

      <!-- Partner Answer -->
      <div class="daily-q-answer partner-answer">
        <div class="answer-header">
          <span class="answer-who">TA 的回答</span>
          <span v-if="partnerAnswered" class="answer-badge done">已回答</span>
          <span v-else class="answer-badge pending">等待中</span>
        </div>
        <div v-if="partnerAnswered">
          <button v-if="!revealPartner" type="button" class="reveal-btn" @click="revealPartner = true">
            <Heart :size="14" fill="currentColor" />
            点击查看 TA 的回答
          </button>
          <div v-else class="answer-content">
            <p class="answer-text">{{ todayQuestion.partnerAnswer?.answerText }}</p>
          </div>
        </div>
        <div v-else class="answer-waiting">
          <p>TA 还没有回答，等 TA 回答后就能看到啦</p>
        </div>
      </div>

      <!-- Both answered celebration -->
      <div v-if="todayQuestion.bothAnswered" class="daily-q-celebrate">
        <span>🎉</span>
        <p>你们今天都回答了！看看彼此的答案吧</p>
      </div>
    </div>

    <div v-else-if="!loading" class="daily-q-empty">
      <p>暂无今日问题</p>
    </div>

    <!-- History toggle -->
    <div v-if="recentQuestions.length > 0" class="daily-q-history-section">
      <button type="button" class="history-toggle" @click="showHistory = !showHistory">
        <ChevronDown :size="14" :class="{ rotated: showHistory }" />
        查看最近的问题 ({{ recentQuestions.length }})
      </button>
      <Transition name="history-slide">
        <div v-if="showHistory" class="history-list">
          <div v-for="q in recentQuestions" :key="q.id" class="history-item">
            <p class="history-date">{{ formatDate(q.questionDate) }}</p>
            <p class="history-question">{{ q.questionText }}</p>
            <div class="history-answers">
              <div v-if="q.myAnswer" class="history-my">
                <small>我：</small>{{ q.myAnswer.answerText }}
              </div>
              <div v-if="q.partnerAnswer" class="history-partner">
                <small>TA：</small>{{ q.partnerAnswer.answerText }}
              </div>
              <p v-if="!q.myAnswer && !q.partnerAnswer" class="history-none">双方都未回答</p>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <p v-if="error" class="widget-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.daily-q-widget{padding:20px 22px;background:linear-gradient(135deg,rgba(248,245,255,.95),rgba(255,248,252,.9));overflow:hidden}
.daily-q-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:16px}
.daily-q-header h3{margin:3px 0 0;color:#4a3560;font-size:17px}
.daily-q-header>svg{color:#b080c0}
.daily-q-card{position:relative;padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,rgba(230,215,255,.5),rgba(255,225,245,.4));margin-bottom:16px;border:1px solid rgba(180,140,210,.12)}
.daily-q-sparkle{position:absolute;top:12px;right:14px;color:#c8a0e0;opacity:.6}
.daily-q-text{margin:0;font-size:16px;font-weight:600;color:#4a3560;line-height:1.5}
.daily-q-date{margin:8px 0 0;font-size:10px;color:#9a80a0}
.daily-q-answer{margin-bottom:12px;padding:14px;border-radius:14px;border:1px solid rgba(180,140,210,.1)}
.my-answer{background:rgba(240,230,255,.3)}
.partner-answer{background:rgba(255,235,248,.3)}
.answer-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.answer-who{font-size:11px;font-weight:700;color:#6a4d7e}
.answer-badge{padding:2px 8px;border-radius:8px;font-size:9px;font-weight:700}
.answer-badge.done{background:rgba(140,200,160,.2);color:#4a9a6e}
.answer-badge.pending{background:rgba(200,180,220,.2);color:#9a80a0}
.answer-content{padding:4px 0}
.answer-text{margin:0;font-size:13px;color:#4a3560;line-height:1.55}
.answer-form{display:flex;flex-direction:column;gap:8px}
.answer-input{width:100%;min-height:60px;padding:10px 12px;border:1px solid rgba(180,140,210,.2);border-radius:10px;background:rgba(255,255,255,.8);color:#4a3560;font-size:12px;line-height:1.5;resize:vertical;outline:none;font-family:inherit}
.answer-input::placeholder{color:#b8a0c0}
.answer-input:focus{border-color:rgba(160,100,200,.4)}
.answer-submit{display:flex;align-items:center;justify-content:center;gap:6px;align-self:flex-end;padding:7px 18px;border:0;border-radius:10px;background:linear-gradient(135deg,#9a60c0,#c06a9e);color:#fff;font-size:10px;font-weight:700;cursor:pointer;box-shadow:0 4px 10px rgba(150,80,180,.15)}
.answer-submit:disabled{opacity:.5;cursor:default}
.answer-waiting p{margin:0;font-size:11px;color:#9a80a0;font-style:italic}
.reveal-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid rgba(200,120,170,.2);border-radius:10px;background:rgba(255,240,250,.6);color:#a05080;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s ease}
.reveal-btn:hover{background:rgba(255,230,245,.8);border-color:rgba(200,120,170,.35)}
.daily-q-celebrate{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,rgba(255,240,200,.4),rgba(255,220,240,.3));margin-top:4px}
.daily-q-celebrate span{font-size:20px}
.daily-q-celebrate p{margin:0;font-size:11px;color:#7a5a40;font-weight:600}
.daily-q-empty{text-align:center;padding:20px 0;color:#9a80a0;font-size:12px}
.daily-q-history-section{margin-top:14px;padding-top:12px;border-top:1px solid rgba(180,140,210,.1)}
.history-toggle{display:flex;align-items:center;gap:6px;width:100%;padding:0;border:0;background:transparent;color:#8a6d9e;font-size:11px;font-weight:600;cursor:pointer}
.history-toggle svg{transition:transform .2s ease}
.history-toggle svg.rotated{transform:rotate(180deg)}
.history-list{margin-top:10px;display:flex;flex-direction:column;gap:10px}
.history-item{padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.4);border:1px solid rgba(180,140,210,.08)}
.history-date{margin:0 0 4px;font-size:9px;font-weight:700;color:#a080a8;text-transform:uppercase;letter-spacing:.3px}
.history-question{margin:0 0 6px;font-size:12px;font-weight:600;color:#5a3d60}
.history-answers{display:flex;flex-direction:column;gap:4px}
.history-my,.history-partner{font-size:11px;color:#5a4060;line-height:1.4}
.history-my small,.history-partner small{font-weight:700;color:#8a6d9e}
.history-none{margin:0;font-size:10px;color:#b0a0b0;font-style:italic}
.widget-error{margin:8px 0 0;padding:6px 10px;background:#ffe6ef;color:#b64f73;font-size:10px;border-radius:8px}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.history-slide-enter-active,.history-slide-leave-active{transition:all .25s ease}
.history-slide-enter-from,.history-slide-leave-to{opacity:0;max-height:0;overflow:hidden}
.history-slide-enter-to,.history-slide-leave-from{max-height:600px}
@media(max-width:760px){.daily-q-text{font-size:14px}.answer-input{min-height:50px;font-size:11px}.daily-q-card{padding:14px 16px}}
</style>
