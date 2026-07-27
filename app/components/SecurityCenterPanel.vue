<script setup lang="ts">
import { AlertTriangle, Download, Laptop, LogOut, ShieldCheck, Trash2, Unlink, X } from '@lucide/vue'

const emit = defineEmits<{ close: []; 'account-deleted': []; 'couple-left': [] }>()
const { working, error, loginAnomaly, devices, exportData, deleteAccount, leaveCouple, recordLoginDevice } = useAccountSecurity()
const dangerOpen = ref(false)
const leaveOpen = ref(false)
const confirmation = ref('')
const success = ref('')
onMounted(() => { void recordLoginDevice() })

async function exportAll() { await exportData(); if (!error.value) success.value = '数据包已开始下载' }
async function removeAccount() {
  if (confirmation.value !== '删除我的账户') return
  try { await deleteAccount(); emit('account-deleted') } catch { /* error is shown in the panel */ }
}
async function leaveSpace() {
  try { await leaveCouple(); leaveOpen.value = false; success.value = '已注销当前情侣空间'; emit('couple-left') } catch { /* error is shown in the panel */ }
}
</script>

<template>
  <div class="security-overlay" @click.self="emit('close')">
    <section class="security-panel" role="dialog" aria-modal="true" aria-labelledby="security-title">
      <header><div><p class="eyebrow">ACCOUNT SECURITY</p><h2 id="security-title">账户安全中心</h2><span>管理数据、设备和情侣空间关系。</span></div><button class="close" type="button" aria-label="关闭" @click="emit('close')"><X :size="20" /></button></header>
      <section class="security-status" :class="{ anomaly: loginAnomaly }"><ShieldCheck :size="20" /><div><strong>{{ loginAnomaly ? '检测到新的登录设备' : '账户状态正常' }}</strong><small>{{ loginAnomaly ? '当前设备信息与上次记录不同，请确认是你本人操作。' : '登录凭据不会在这里显示，所有敏感操作都需要再次确认。' }}</small></div></section>
      <section class="security-section"><h3>数据与隐私</h3><button class="security-action" type="button" :disabled="working" @click="exportAll"><Download :size="17" /><span><strong>导出照片、日记和消息</strong><small>下载 JSON 数据包，包含私密媒体的临时访问地址。</small></span></button><p class="security-note">导出链接会过期，请下载后妥善保存。</p></section>
      <section class="security-section"><h3>登录设备</h3><div class="device-list"><article v-for="device in devices" :key="device.name"><Laptop :size="18" /><div><strong>{{ device.name }} <em v-if="device.current">当前设备</em></strong><small>{{ device.detail }} · {{ device.lastSeen }}</small></div></article></div><p class="security-note">当前版本仅显示当前会话；远程会话撤销需要在 Supabase Auth 管理后台执行。</p></section>
      <section class="security-section"><h3>情侣空间</h3><button class="security-action" type="button" @click="leaveOpen = true"><Unlink :size="17" /><span><strong>注销情侣空间 / 更换绑定伴侣</strong><small>退出当前空间后，可使用新的邀请码加入另一半的空间。</small></span></button></section>
      <section class="security-section danger-section"><h3>不可逆操作</h3><button class="security-action danger" type="button" @click="dangerOpen = true"><Trash2 :size="17" /><span><strong>删除账户</strong><small>删除登录账户；有伴侣时会保留共同内容并移除你的成员身份。</small></span></button></section>
      <p v-if="success" class="security-success"><ShieldCheck :size="14" /> {{ success }}</p><p v-if="error" class="security-error"><AlertTriangle :size="14" /> {{ error }}</p>
      <footer><button type="button" @click="emit('close')"><LogOut :size="16" />返回设置</button></footer>
      <div v-if="leaveOpen" class="security-confirm"><Unlink :size="27" /><h3>注销当前情侣空间？</h3><p>共同内容会保留，但你将退出这个空间。之后可以重新绑定新的伴侣。</p><div><button type="button" @click="leaveOpen = false">取消</button><button class="danger" :disabled="working" type="button" @click="leaveSpace">确认注销</button></div></div>
      <div v-if="dangerOpen" class="security-confirm"><AlertTriangle :size="27" /><h3>删除账户</h3><p>这是不可逆操作。请输入下面的文字确认：</p><strong>删除我的账户</strong><input v-model="confirmation" placeholder="输入：删除我的账户"><div><button type="button" @click="dangerOpen = false; confirmation = ''">取消</button><button class="danger" :disabled="working || confirmation !== '删除我的账户'" type="button" @click="removeAccount">永久删除</button></div></div>
    </section>
  </div>
</template>

<style scoped>
.security-overlay{position:fixed;z-index:90;inset:0;display:grid;place-items:center;padding:20px;background:rgba(45,35,54,.34);backdrop-filter:blur(13px)}.security-panel{position:relative;width:min(100%,620px);max-height:calc(100dvh - 40px);overflow:auto;padding:27px;border:1px solid rgba(255,255,255,.9);border-radius:30px;background:linear-gradient(145deg,#fffaff,#fff2f9);box-shadow:0 30px 85px rgba(60,35,71,.22);color:#53365d}.security-panel>header{display:flex;justify-content:space-between;gap:14px}.security-panel h2{margin:3px 0 5px;font-size:27px}.security-panel header span{color:#96859b;font-size:10px}.close{display:grid;place-items:center;width:37px;height:37px;border:0;border-radius:12px;background:#f0e9f4;color:#74557d;cursor:pointer}.security-status{display:flex;gap:10px;margin-top:20px;padding:13px;border:1px solid rgba(105,165,125,.2);border-radius:17px;background:#f2faf5;color:#5d9870}.security-status strong,.security-status small{display:block}.security-status strong{font-size:11px}.security-status small{margin-top:4px;color:#849b8b;font-size:9px;line-height:1.5}.security-section{margin-top:20px;padding-top:17px;border-top:1px solid rgba(176,129,193,.14)}.security-section h3{margin:0 0 10px;color:#67416f;font-size:12px}.security-action{display:flex;align-items:center;gap:10px;width:100%;padding:13px;border:1px solid rgba(180,127,196,.18);border-radius:16px;background:rgba(255,255,255,.72);color:#80578a;text-align:left;cursor:pointer}.security-action:disabled{opacity:.6;cursor:wait}.security-action span{min-width:0}.security-action strong,.security-action small{display:block}.security-action strong{color:#65406d;font-size:11px}.security-action small{margin-top:4px;color:#9985a0;font-size:9px;line-height:1.5}.security-action.danger{border-color:rgba(196,91,122,.2);color:#b75c76}.security-action.danger strong{color:#a34d68}.security-note{margin:7px 0 0;color:#a18ca5;font-size:9px;line-height:1.5}.device-list{display:grid;gap:8px}.device-list article{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:rgba(247,240,249,.75);color:#8a6594}.device-list strong,.device-list small{display:block}.device-list strong{color:#67416f;font-size:10px}.device-list small{margin-top:3px;color:#9a899e;font-size:9px}.device-list em{margin-left:5px;padding:3px 5px;border-radius:6px;background:#e4f5e9;color:#5a9b70;font-size:8px;font-style:normal}.security-success,.security-error{display:flex;align-items:center;gap:5px;margin:13px 0 0;padding:9px 11px;border-radius:11px;font-size:10px}.security-success{background:#eaf8ef;color:#4b8c68}.security-error{background:#ffe9ef;color:#b85874}.security-panel>footer{display:flex;justify-content:flex-end;margin-top:21px}.security-panel>footer button{display:flex;align-items:center;gap:6px;min-height:39px;padding:0 13px;border:1px solid #eadfeb;border-radius:13px;background:#fff;color:#76537f;font-size:10px;cursor:pointer}.security-confirm{position:absolute;z-index:2;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:35px;background:rgba(255,250,255,.98);text-align:center}.security-confirm>svg{color:#ba6580}.security-confirm h3{margin:13px 0 7px;color:#5d3568}.security-confirm p{max-width:350px;margin:0;color:#8b778f;font-size:10px;line-height:1.7}.security-confirm>strong{margin-top:12px;color:#6d4776;font-size:13px}.security-confirm input{width:min(100%,300px);margin-top:10px;padding:12px;border:1px solid #e3d6e8;border-radius:13px;outline:0;background:#fff;text-align:center;font:inherit;font-size:11px}.security-confirm>div{display:flex;gap:8px;margin-top:20px}.security-confirm button{min-height:39px;padding:0 15px;border:0;border-radius:12px;background:#f0e8f2;color:#72527b;font-size:10px;font-weight:750;cursor:pointer}.security-confirm button.danger{background:#b85d78;color:#fff}.security-confirm button:disabled{opacity:.5;cursor:wait}@media(max-width:650px){.security-overlay{align-items:end;padding:0}.security-panel{max-height:calc(100dvh - env(safe-area-inset-top));padding:21px 17px calc(18px + env(safe-area-inset-bottom));border-radius:25px 25px 0 0}.security-panel h2{font-size:23px}.security-confirm{position:fixed;padding:25px 18px}}
.security-status.anomaly{border-color:rgba(199,128,76,.24);background:#fff7ed;color:#bd7542}.security-status.anomaly small{color:#ad8b72}
</style>
