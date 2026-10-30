export type DailyQuestion = {
  id: string
  questionText: string
  questionDate: string
  coupleId: string
  createdAt: string
}

export type DailyAnswer = {
  id: string
  questionId: string
  userId: string
  answerText: string
  createdAt: string
}

export type DailyQuestionWithAnswers = DailyQuestion & {
  myAnswer: DailyAnswer | null
  partnerAnswer: DailyAnswer | null
  bothAnswered: boolean
}

const DEFAULT_QUESTIONS = [
  '今天最让你感动的一件小事是什么？',
  '你最想和我一起去做什么？',
  '你觉得我们在一起后最大的变化是什么？',
  '你最喜欢我的哪个小习惯？',
  '如果今天只能做一件事，你会选择什么？',
  '你最近学到的一个新东西是什么？',
  '你最想对我说什么但还没说出口的话？',
  '你童年最快乐的记忆是什么？',
  '你觉得我们的第一次约会在哪里最好？',
  '你最喜欢的一首歌是什么？为什么？',
  '如果可以去任何地方旅行，你想去哪里？',
  '你最感激我为你做的什么事？',
  '你最近做的一个有趣的梦是什么？',
  '你觉得我们最像哪对情侣/夫妻？为什么？',
  '你小时候最害怕什么？',
  '你最喜欢的食物是什么？想和我一起做吗？',
  '如果可以拥有一种超能力，你想要什么？',
  '你觉得我最可爱的地方是什么？',
  '你最近听的一首歌是什么？',
  '你最想实现的三个愿望是什么？',
  '你觉得我们最默契的一件事是什么？',
  '你最喜欢的电影是什么？想一起看吗？',
  '你最近笑的最开心的一次是因为什么？',
  '如果可以回到过去，你想回到我们的哪个时刻？',
  '你觉得我们的家应该是什么样的？',
  '你最想和我一起学的技能是什么？',
  '你最喜欢的季节是什么？为什么？',
  '你最近读的一本书或看的一部剧是什么？',
  '你觉得我最让你惊喜的是什么？',
  '你最喜欢我们一起做的什么事？',
]

const todayQuestion = ref<DailyQuestionWithAnswers | null>(null)
const recentQuestions = ref<DailyQuestionWithAnswers[]>([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')

function mapQuestion(row: any): DailyQuestion {
  return {
    id: String(row?.id || ''),
    questionText: String(row?.question_text || ''),
    questionDate: String(row?.question_date || new Date().toISOString().slice(0, 10)),
    coupleId: String(row?.couple_id || ''),
    createdAt: String(row?.created_at || new Date().toISOString()),
  }
}

function mapAnswer(row: any): DailyAnswer {
  return {
    id: String(row?.id || ''),
    questionId: String(row?.question_id || ''),
    userId: String(row?.user_id || ''),
    answerText: String(row?.answer_text || ''),
    createdAt: String(row?.created_at || new Date().toISOString()),
  }
}

function storageKey(coupleId: string) { return `couple-space-daily-q:${coupleId}` }

export function useDailyQuestions() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const { members } = useAccountManagement()
  const partnerProfile = computed(() => members.value.find(m => m.id !== profile.value?.id))

  function todayStr() { return new Date().toISOString().slice(0, 10) }

  function getQuestionForDate(dateStr: string): string {
    const dayOfYear = Math.floor((Date.parse(dateStr) - Date.parse(dateStr.slice(0, 4) + '-01-01')) / 86400000)
    return DEFAULT_QUESTIONS[dayOfYear % DEFAULT_QUESTIONS.length]
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true
    error.value = ''
    try {
      const coupleId = profile.value?.coupleId || 'demo'
      const userId = profile.value?.id || 'demo-user'
      const partnerId = partnerProfile.value?.id || ''
      const today = todayStr()

      if (!$supabase || demoMode.value) {
        const raw = localStorage.getItem(storageKey(coupleId))
        const parsed = raw ? JSON.parse(raw) as any[] : []
        todayQuestion.value = parsed.find((q: any) => q.questionDate === today) || null
        recentQuestions.value = parsed.slice(0, 7)
        if (!todayQuestion.value) {
          todayQuestion.value = {
            id: crypto.randomUUID(),
            questionText: getQuestionForDate(today),
            questionDate: today,
            coupleId,
            createdAt: new Date().toISOString(),
            myAnswer: null,
            partnerAnswer: null,
            bothAnswered: false,
          }
        }
        return
      }

      // Load today's question
      let qRow: any = null
      const { data: existingQ, error: qError } = await $supabase
        .from('daily_questions')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('question_date', today)
        .maybeSingle()
      if (qError) throw qError

      if (existingQ) {
        qRow = existingQ
      } else {
        const { data: newQ, error: insertError } = await $supabase
          .from('daily_questions')
          .insert({ couple_id: coupleId, question_text: getQuestionForDate(today), question_date: today })
          .select()
          .single()
        if (insertError) throw insertError
        qRow = newQ
      }

      const question = mapQuestion(qRow)

      // Load answers
      const { data: answers, error: aError } = await $supabase
        .from('daily_answers')
        .select('*')
        .eq('question_id', question.id)
      if (aError) throw aError

      const mappedAnswers = (answers || []).map(mapAnswer)
      const myAnswer = mappedAnswers.find(a => a.userId === userId) || null
      const partnerAnswer = mappedAnswers.find(a => a.userId === partnerId) || null

      todayQuestion.value = {
        ...question,
        myAnswer,
        partnerAnswer,
        bothAnswered: Boolean(myAnswer && partnerAnswer),
      }

      // Load recent 7 days
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data: recentQs } = await $supabase
        .from('daily_questions')
        .select('*')
        .eq('couple_id', coupleId)
        .gte('question_date', weekAgo.toISOString().slice(0, 10))
        .neq('question_date', today)
        .order('question_date', { ascending: false })
        .limit(7)

      const recent: DailyQuestionWithAnswers[] = []
      for (const rq of (recentQs || [])) {
        const q = mapQuestion(rq)
        const { data: ra } = await $supabase.from('daily_answers').select('*').eq('question_id', q.id)
        const raMapped = (ra || []).map(mapAnswer)
        recent.push({
          ...q,
          myAnswer: raMapped.find(a => a.userId === userId) || null,
          partnerAnswer: raMapped.find(a => a.userId === partnerId) || null,
          bothAnswered: Boolean(raMapped.find(a => a.userId === userId) && raMapped.find(a => a.userId === partnerId)),
        })
      }
      recentQuestions.value = recent
    } catch (cause: any) {
      error.value = cause?.message || '加载每日问答失败'
    } finally {
      loading.value = false
    }
  }

  async function submitAnswer(answerText: string) {
    if (busy.value || !todayQuestion.value) return
    if (!answerText.trim()) return
    busy.value = true
    error.value = ''
    try {
      const userId = profile.value?.id || 'demo-user'
      const coupleId = profile.value?.coupleId || 'demo'

      if (!$supabase || demoMode.value) {
        const answer: DailyAnswer = { id: crypto.randomUUID(), questionId: todayQuestion.value.id, userId, answerText: answerText.trim(), createdAt: new Date().toISOString() }
        todayQuestion.value.myAnswer = answer
        todayQuestion.value.bothAnswered = Boolean(todayQuestion.value.myAnswer && todayQuestion.value.partnerAnswer)
        const raw = localStorage.getItem(storageKey(coupleId))
        const parsed = raw ? JSON.parse(raw) as any[] : []
        const idx = parsed.findIndex(q => q.id === todayQuestion.value!.id)
        if (idx >= 0) parsed[idx] = { ...parsed[idx], myAnswer: answer }
        else parsed.unshift({ ...todayQuestion.value, myAnswer: answer })
        localStorage.setItem(storageKey(coupleId), JSON.stringify(parsed))
        return answer
      }

      const { data, error: upsertError } = await $supabase
        .from('daily_answers')
        .upsert({ question_id: todayQuestion.value.id, couple_id: coupleId, user_id: userId, answer_text: answerText.trim() }, { onConflict: 'question_id,user_id' })
        .select()
        .single()
      if (upsertError) throw upsertError
      const mapped = mapAnswer(data)
      todayQuestion.value.myAnswer = mapped
      todayQuestion.value.bothAnswered = Boolean(todayQuestion.value.myAnswer && todayQuestion.value.partnerAnswer)
      return mapped
    } catch (cause: any) {
      error.value = cause?.message || '提交回答失败'
      throw cause
    } finally {
      busy.value = false
    }
  }

  return { todayQuestion, recentQuestions, loading, busy, error, load, submitAnswer, getQuestionForDate }
}
