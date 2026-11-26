const $ = id => document.getElementById(id);
const SETTINGS_KEY = "h3long_generator_v4";

function snapFrames(seconds) {
  let n = Math.max(5, Math.round(Number(seconds) * 24));
  while (n % 17 !== 5) n += 1;
  return n;
}
function setStatus(msg, kind) {
  const el = $("status");
  el.className = kind || "";
  el.textContent = msg;
}
function splitIdea(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (text.includes("\n---\n") || text.startsWith("---")) return text.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
  const numbered = text.split(/\n(?=\d+\.\s)/).map(s => s.trim()).filter(s => /^\d+\./.test(s));
  return numbered.length > 1 ? numbered : null;
}
function stripLockLanguage(s) {
  return String(s || "")
    .replace(/Continue seamlessly from the supplied first frame\.[^\n]*/gi, "")
    .replace(/For the target video, at 0\.00 seconds[\s\S]*?referenced\.\s*/gi, "")
    .replace(/\b(3D CG,?\s*)?feature-cartoon,?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function buildShotText(idea, i, n, mode) {
  const body = stripLockLanguage(idea);
  if (mode === "cut") {
    const open = i === 0
      ? "New scene. Establish the place, the people, the light, and the sound."
      : "New scene. This is a deliberate cut to a different place or time. Do not continue the previous camera move.";
    return open + " " + body + " Hold identity of anyone who returns. End the shot on a settled pose.";
  }
  if (i === 0) return "Establish the subject, wardrobe, place, light, and the audio bed. " + body + " The camera and the subject are still moving at the last frame. Do not land the action yet.";
  if (i === n - 1) return "Continue the same people, wardrobe, place, light, and direction of motion from the previous tail. Do not re-establish the scene and do not lock to a still. " + body + " Let the action settle only in the final beat. The sound continues without a restart.";
  return "Continue the same people, wardrobe, place, light, and direction of motion from the previous tail. Do not re-establish the scene and do not lock to a still. " + body + " Keep moving through the last frame. The sound continues without a restart.";
}
function collectShots() {
  return [...document.querySelectorAll("#shotBox textarea")].map(t => t.value.trim()).filter(Boolean);
}
function renderShots(texts) {
  const box = $("shotBox");
  box.innerHTML = "";
  texts.forEach((text, i) => {
    const card = document.createElement("div");
    card.className = "shot";
    card.innerHTML = "<h3>Shot " + (i + 1) + "</h3>";
    const ta = document.createElement("textarea");
    ta.value = text;
    card.appendChild(ta);
    box.appendChild(card);
  });
}
function plannerSystem() {
  const rule = $("join").value === "cut"
    ? "Join mode is cut. Each shot is a deliberate new scene. Do not continue the previous camera move or morph one location into the next."
    : "Join mode is latent_handoff. One continuous scene. Do NOT write last-frame lock language, Picture 1, or 'no cut no fade'. Shot 1 is still moving at the last frame. Later shots continue the same people, place, light, and direction of motion and describe only the next beat. The last shot may land.";
  return "You write shot prompts for ComfyUI H3MultishotMemorySampler.\n" + rule + "\nEach shot is one plain-text block: picture, camera move, physical sound, and optional dialogue as <d>[English] exact words</d>.\nNo cartoon language unless the user asked for it.\nOutput ONLY JSON: {\"shots\":[\"shot 1 text\"]}\nUse exactly the requested number of shots. Maximum 8.";
}
function openAIBase(raw) {
  let root = String(raw || "").trim();
  if (!root) throw new Error("Enter a base URL");
  root = root.replace(/\/+$/, "").replace(/\/(chat\/completions|completions|models)$/i, "").replace(/\/+$/, "");
  root = root.replace(/(\/v1)+$/i, "/v1");
  if (!/\/v1$/i.test(root)) root += "/v1";
  return root;
}
function corsHint(base, err) {
  return "Could not reach " + base + ". If this page was opened from disk, enable CORS on that server. " + ((err && err.message) || "");
}
async function readApiJson(res, label) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  const errMsg = data && data.error ? (data.error.message || data.error) : "";
  if (!res.ok) throw new Error(label + " " + res.status + ": " + String(errMsg || text).slice(0, 300));
  if (errMsg) throw new Error(label + ": " + errMsg);
  return data || {};
}
async function callOpenAICompat(base, model, apiKey, userMsg) {
  const root = openAIBase(base);
  if (!model) throw new Error("Enter a model id");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  let res;
  try {
    res = await fetch(root + "/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: plannerSystem() },
          { role: "user", content: userMsg }
        ],
        temperature: 0.4
      })
    });
  } catch (e) { throw new Error(corsHint(root, e)); }
  const data = await readApiJson(res, root);
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error("The provider returned no message");
  return content;
}
async function listModels(base, apiKey) {
  const root = openAIBase(base);
  const headers = {};
  if (apiKey) headers.Authorization = "Bearer " + apiKey;
  let res;
  try { res = await fetch(root + "/models", { headers }); }
  catch (e) { throw new Error(corsHint(root, e)); }
  const data = await readApiJson(res, root + "/models");
  const ids = (data.data || []).map(m => m && m.id).filter(Boolean);
  if (!ids.length) throw new Error("Reached " + root + "/models but the list was empty. Load a model, or type its id.");
  return ids;
}
function fillSelect(selectEl, ids) {
  const keep = selectEl.value;
  selectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Type an id below";
  selectEl.appendChild(blank);
  ids.forEach(id => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = id;
    selectEl.appendChild(o);
  });
  if (keep && ids.includes(keep)) selectEl.value = keep;
  else if (ids[0]) selectEl.value = ids[0];
}
function parseShots(raw) {
  const text = String(raw || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { data = null; }
  let shots = [];
  if (data && Array.isArray(data.shots)) shots = data.shots;
  else if (data && Array.isArray(data.segments)) shots = data.segments.map(s => (s && (s.prompt || s.text)) || "").filter(Boolean);
  else if (text.includes("\n---\n")) shots = text.split(/\n---\n/);
  shots = shots.map(s => stripLockLanguage(s)).filter(Boolean).slice(0, 8);
  if (!shots.length) throw new Error("The provider did not return a shots list. Expected {\"shots\":[\"...\"]}.");
  return shots;
}
async function enhanceShots() {
  const provider = $("provider").value;
  if (provider === "none") throw new Error("Choose LM Studio, Grok, or another provider. None only does the local rewrite.");
  const n = Math.max(1, Math.min(8, Number($("shots").value) || 1));
  const userMsg = "raw_user_prompt: " + $("idea").value.trim() + "\nshot_count: " + n + "\nseconds_each: " + $("seconds").value + "\njoin_mode: " + $("join").value;
  let content = "";
  if (provider === "lmstudio") {
    content = await callOpenAICompat($("lmstudioUrl").value, $("lmstudioModel").value.trim() || $("lmstudioModelSelect").value, "", userMsg);
  } else if (provider === "xai") {
    const key = $("apiKey").value.trim();
    if (!key) throw new Error("Grok needs an xAI API key and an internet connection. Offline, switch the provider to LM Studio.");
    const model = $("grokModel").value === "custom" ? $("grokCustom").value.trim() : $("grokModel").value;
    content = await callOpenAICompat("https://api.x.ai/v1", model, key, userMsg);
  } else if (provider === "openai") {
    const key = $("apiKey").value.trim();
    if (!key) throw new Error("OpenAI needs an API key and an internet connection. Offline, switch the provider to LM Studio.");
    content = await callOpenAICompat("https://api.openai.com/v1", $("openaiModel").value.trim(), key, userMsg);
  } else if (provider === "custom") {
    content = await callOpenAICompat($("customUrl").value, $("customModel").value.trim(), $("apiKey").value.trim(), userMsg);
  } else if (provider === "ollama") {
    const root = $("ollamaUrl").value.replace(/\/$/, "");
    let res;
    try {
      res = await fetch(root + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: $("ollamaModel").value.trim(),
          messages: [{ role: "system", content: plannerSystem() }, { role: "user", content: userMsg }],
          stream: false,
          options: { temperature: 0.4 }
        })
      });
    } catch (e) { throw new Error(corsHint(root, e)); }
    if (!res.ok) throw new Error("Ollama " + res.status);
    const data = await res.json();
    content = (data.message && data.message.content) || "";
  }
  const shots = parseShots(content);
  $("shots").value = shots.length;
  renderShots(shots);
  return shots.length;
}
function showProvider() {
  const p = $("provider").value;
  $("apiKeyGroup").style.display = (p === "xai" || p === "openai" || p === "custom") ? "" : "none";
  $("grokModelGroup").style.display = p === "xai" ? "" : "none";
  $("lmstudioGroup").style.display = p === "lmstudio" ? "" : "none";
  $("ollamaGroup").style.display = p === "ollama" ? "" : "none";
  $("customGroup").style.display = p === "custom" ? "" : "none";
  $("openaiGroup").style.display = p === "openai" ? "" : "none";
  $("btnEnhance").disabled = p === "none";
}
function widgetNode(type, title, pos, named, inputs, outputs, size) {
  return {
    id: 0, type, title, pos, size: size || [340, 140], flags: {}, order: 0, mode: 0,
    inputs, outputs,
    properties: { cnr_id: type.indexOf("H3") === 0 ? "comfyui-h3-multishot" : "comfy-core", ver: "0.33.0", "Node name for S&R": type },
    widgets_values: Object.values(named),
    widgets_values_named: named
  };
}
function buildWorkflow(shotTexts) {
  const width = Number($("width").value);
  const height = Number($("height").value);
  const frames = snapFrames($("seconds").value);
  const continuity = $("join").value;
  const named = {
    script: shotTexts.join("\n---\n"), shot_count: shotTexts.length, width, height, frames_per_shot: frames,
    seed: Number($("seed").value) || 0, control_after_generate: "fixed",
    steps: Number($("steps").value) || 20, seed_per_shot: false,
    memory_frames: continuity === "latent_handoff" ? 1 : 0, anchor_frames: 1,
    sampler_name: "res_multistep", scheduler: "simple", bank_pinned: 1,
    chain_gain_control: "off", continuity, bank_clip_frames: 22, color_level: "off",
    join_anchor_noise: 0.02, join_blend: false, handoff_release: 0.3, bank_ref_noise: 0.02,
    end_anchor: false, join_fx: "off", audio_lock: true,
    handoff_taper: continuity === "latent_handoff" ? 4 : 0, handoff_depth: "block",
    self_anchor_voice: false, reference_image_size: "match", preview_first_shot: true,
    output_scale: 1, save_every_shot: true, upscale_model_name: "(none)",
    master_normalize: "luma+contrast", pin_frames: "22", pin_noise: 0.05, pin_renorm: true,
    reference_subjects: "", low_ram_master: true, audio_pin_frames: 0
  };
  const samplerInputs = [
    { name: "model", type: "MODEL", link: null },
    { name: "clip", type: "CLIP", link: null },
    { name: "video_vae", type: "VAE", link: null },
    { name: "audio_vae", type: "VAE", link: null }
  ];
  if ($("optStart").checked && $("startImage").value.trim()) samplerInputs.push({ name: "start_image", type: "IMAGE", link: null });
  const nodes = [
    widgetNode("UNETLoader", "UNET", [40, 40], { unet_name: $("unetName").value.trim(), weight_dtype: "default" }, [
      { name: "unet_name", type: "COMBO", widget: { name: "unet_name" }, link: null },
      { name: "weight_dtype", type: "COMBO", widget: { name: "weight_dtype" }, link: null }
    ], [{ name: "MODEL", type: "MODEL", links: [] }]),
    widgetNode("CLIPLoader", "CLIP", [40, 220], { clip_name: $("clipName").value.trim(), type: "minimax", device: "default" }, [
      { name: "clip_name", type: "COMBO", widget: { name: "clip_name" }, link: null },
      { name: "type", type: "COMBO", widget: { name: "type" }, link: null },
      { name: "device", type: "COMBO", widget: { name: "device" }, link: null }
    ], [{ name: "CLIP", type: "CLIP", links: [] }]),
    widgetNode("VAELoader", "Video VAE", [40, 420], { vae_name: $("videoVae").value.trim() }, [
      { name: "vae_name", type: "COMBO", widget: { name: "vae_name" }, link: null }
    ], [{ name: "VAE", type: "VAE", links: [] }]),
    widgetNode("VAELoader", "Audio VAE", [40, 580], { vae_name: $("audioVae").value.trim() }, [
      { name: "vae_name", type: "COMBO", widget: { name: "vae_name" }, link: null }
    ], [{ name: "VAE", type: "VAE", links: [] }])
  ];
  let modelFrom = 1;
  if ($("optTurbo").checked) {
    nodes.push(widgetNode("LoraLoaderModelOnly", "Turbo LoRA", [420, 40], { lora_name: $("loraName").value.trim(), strength_model: 1 }, [
      { name: "model", type: "MODEL", link: null },
      { name: "lora_name", type: "COMBO", widget: { name: "lora_name" }, link: null },
      { name: "strength_model", type: "FLOAT", widget: { name: "strength_model" }, link: null }
    ], [{ name: "MODEL", type: "MODEL", links: [] }]));
    modelFrom = nodes.length;
  }
  if ($("optSage").checked) {
    nodes.push(widgetNode("PathchSageAttentionKJ", "SageAttention", [420, 220], { sage_attention: "auto" }, [
      { name: "model", type: "MODEL", link: null },
      { name: "sage_attention", type: "COMBO", widget: { name: "sage_attention" }, link: null }
    ], [{ name: "MODEL", type: "MODEL", links: [] }]));
    modelFrom = nodes.length;
  }
  if ($("optCache").checked) {
    nodes.push(widgetNode("EasyCache", "EasyCache", [420, 400], { reuse_threshold: 0.2, start_percent: 0.15, end_percent: 0.95, verbose: false }, [
      { name: "model", type: "MODEL", link: null },
      { name: "reuse_threshold", type: "FLOAT", widget: { name: "reuse_threshold" }, link: null },
      { name: "start_percent", type: "FLOAT", widget: { name: "start_percent" }, link: null },
      { name: "end_percent", type: "FLOAT", widget: { name: "end_percent" }, link: null },
      { name: "verbose", type: "BOOLEAN", widget: { name: "verbose" }, link: null }
    ], [{ name: "MODEL", type: "MODEL", links: [] }]));
    modelFrom = nodes.length;
  }
  nodes.push(widgetNode("H3MultishotMemorySampler", "Latent handoff sampler", [780, 40], named, samplerInputs, [
    { name: "master_frames", type: "IMAGE", links: [] },
    { name: "master_audio", type: "AUDIO", links: [] },
    { name: "shots_rendered", type: "INT", links: null },
    { name: "video_latents", type: "LATENT", links: null },
    { name: "audio_latents", type: "LATENT", links: null },
    { name: "head_frames", type: "INT", links: null },
    { name: "master_path", type: "STRING", links: null }
  ], [460, 980]));
  const samplerId = nodes.length;
  let startId = 0;
  if ($("optStart").checked && $("startImage").value.trim()) {
    nodes.push(widgetNode("LoadImage", "Identity still", [780, 1100], { image: $("startImage").value.trim() }, [
      { name: "image", type: "COMBO", widget: { name: "image" }, link: null }
    ], [{ name: "IMAGE", type: "IMAGE", links: [] }]));
    startId = nodes.length;
  }
  nodes.push(widgetNode("CreateVideo", "Create master", [1320, 80], { fps: 24, bit_depth: 8 }, [
    { name: "images", type: "IMAGE", link: null },
    { name: "audio", type: "AUDIO", link: null },
    { name: "fps", type: "FLOAT", widget: { name: "fps" }, link: null },
    { name: "bit_depth", type: "INT", widget: { name: "bit_depth" }, link: null }
  ], [{ name: "VIDEO", type: "VIDEO", links: [] }]));
  const createId = nodes.length;
  nodes.push(widgetNode("SaveVideo", "Save master", [1320, 320], { filename_prefix: "video/H3_Handoff", format: "auto", codec: "auto" }, [
    { name: "video", type: "VIDEO", link: null }
  ], [{ name: "video", type: "VIDEO", links: null }], [420, 200]));
  const saveId = nodes.length;
  nodes.forEach((n, i) => { n.id = i + 1; n.order = i; });
  const links = [
    [1, modelFrom, 0, samplerId, 0, "MODEL"],
    [2, 2, 0, samplerId, 1, "CLIP"],
    [3, 3, 0, samplerId, 2, "VAE"],
    [4, 4, 0, samplerId, 3, "VAE"],
    [5, samplerId, 0, createId, 0, "IMAGE"],
    [6, samplerId, 1, createId, 1, "AUDIO"],
    [7, createId, 0, saveId, 0, "VIDEO"]
  ];
  let nextLink = 8;
  if ($("optTurbo").checked) links.push([nextLink++, 1, 0, 5, 0, "MODEL"]);
  if ($("optSage").checked) {
    const sageId = $("optTurbo").checked ? 6 : 5;
    const from = $("optTurbo").checked ? 5 : 1;
    links.push([nextLink++, from, 0, sageId, 0, "MODEL"]);
  }
  if ($("optCache").checked) {
    let cacheId = 5;
    let from = 1;
    if ($("optTurbo").checked) { from = 5; cacheId = 6; }
    if ($("optSage").checked) { from = cacheId; cacheId += 1; }
    links.push([nextLink++, from, 0, cacheId, 0, "MODEL"]);
  }
  if (startId) links.push([nextLink++, startId, 0, samplerId, 4, "IMAGE"]);
  links.forEach(link => {
    const lid = link[0], from = link[1], fromSlot = link[2], to = link[3], toSlot = link[4];
    const src = nodes[from - 1];
    const dst = nodes[to - 1];
    if (!src.outputs[fromSlot].links) src.outputs[fromSlot].links = [];
    src.outputs[fromSlot].links.push(lid);
    if (dst.inputs[toSlot]) dst.inputs[toSlot].link = lid;
  });
  return {
    id: "minimax-h3-v4-latent-handoff", revision: 0,
    last_node_id: nodes.length, last_link_id: links.length,
    nodes, links, groups: [], config: {},
    extra: { notes: "V4. latent_handoff continues the previous tail. cut is a real scene change. Optional Turbo, SageAttention, and EasyCache are off unless checked." },
    version: 0.4
  };
}
function saveSettings() {
  const fields = ["provider","apiKey","grokModel","grokCustom","lmstudioUrl","lmstudioModel","ollamaUrl","ollamaModel","customUrl","customModel","openaiModel","comfyUrl","unetName","clipName","videoVae","audioVae","loraName","startImage","join","preset"];
  const data = {};
  fields.forEach(id => { if ($(id)) data[id] = $(id).value; });
  ["optTurbo","optSage","optCache","optStart"].forEach(id => { data[id] = $(id).checked; });
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}
function loadSettings() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) { data = {}; }
  Object.keys(data).forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!data[id];
    else if (data[id] != null) el.value = data[id];
  });
  $("startImage").disabled = !$("optStart").checked;
  showProvider();
}
$("preset").addEventListener("change", () => {
  const parts = $("preset").value.split("x").map(Number);
  $("width").value = parts[0];
  $("height").value = parts[1];
  saveSettings();
});
$("provider").addEventListener("change", () => { showProvider(); saveSettings(); });
$("optStart").addEventListener("change", () => { $("startImage").disabled = !$("optStart").checked; saveSettings(); });
document.querySelectorAll("input, select").forEach(el => el.addEventListener("change", saveSettings));
$("lmstudioModelSelect").addEventListener("change", () => {
  if ($("lmstudioModelSelect").value) $("lmstudioModel").value = $("lmstudioModelSelect").value;
  saveSettings();
});
$("btnShots").addEventListener("click", () => {
  const n = Math.max(1, Math.min(8, Number($("shots").value) || 1));
  const mode = $("join").value;
  const pasted = splitIdea($("idea").value);
  const blocks = pasted && pasted.length ? pasted.slice(0, 8) : Array.from({ length: n }, () => $("idea").value.trim());
  if (!blocks[0]) { setStatus("Paste a story first.", "error"); return; }
  $("shots").value = blocks.length;
  renderShots(blocks.map((idea, i) => buildShotText(idea, i, blocks.length, mode)));
  setStatus(mode === "latent_handoff" ? "Local rewrite. No API was called." : "Local rewrite for scene cuts. No API was called.", "ok");
});
$("btnEnhance").addEventListener("click", async () => {
  $("btnEnhance").disabled = true;
  setStatus("Asking " + $("provider").value + "...", "");
  try {
    const count = await enhanceShots();
    setStatus("Enhanced " + count + " shots with " + $("provider").value + ". Read them before downloading.", "ok");
  } catch (e) { setStatus(e.message || String(e), "error"); }
  finally { showProvider(); }
});
$("btnLmModels").addEventListener("click", async () => {
  try {
    const ids = await listModels($("lmstudioUrl").value, "");
    fillSelect($("lmstudioModelSelect"), ids);
    if ($("lmstudioModelSelect").value) $("lmstudioModel").value = $("lmstudioModelSelect").value;
    setStatus("Listed " + ids.length + " LM Studio model(s).", "ok");
  } catch (e) { setStatus(e.message || String(e), "error"); }
});
$("btnGrokModels").addEventListener("click", async () => {
  try {
    const ids = (await listModels("https://api.x.ai/v1", $("apiKey").value.trim())).filter(id => /^grok-/.test(id));
    const sel = $("grokModel");
    const current = sel.value;
    sel.innerHTML = "";
    ids.forEach(id => {
      const o = document.createElement("option");
      o.value = id; o.textContent = id; sel.appendChild(o);
    });
    const custom = document.createElement("option");
    custom.value = "custom"; custom.textContent = "Custom model id";
    sel.appendChild(custom);
    sel.value = ids.includes(current) ? current : (ids[0] || "custom");
    setStatus("Listed " + ids.length + " Grok model(s).", "ok");
  } catch (e) { setStatus(e.message || String(e), "error"); }
});
$("btnCustomModels").addEventListener("click", async () => {
  try {
    const ids = await listModels($("customUrl").value, $("apiKey").value.trim());
    if (!$("customModel").value.trim()) $("customModel").value = ids[0];
    setStatus("Listed " + ids.length + " model(s).", "ok");
  } catch (e) { setStatus(e.message || String(e), "error"); }
});
$("btnFree").addEventListener("click", async () => {
  const base = ($("comfyUrl").value || "http://127.0.0.1:8188").trim().replace(/\/+$/, "");
  $("btnFree").disabled = true;
  try {
    const res = await fetch(base + "/free", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unload_models: true, free_memory: true }) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    setStatus("Unloaded models on " + base + ".", "ok");
  } catch (e) {
    setStatus("Browser blocked the call to " + base + ". ComfyUI is up, but it was started without CORS, so a page opened from disk cannot reach it. Restart ComfyUI once (the launch flag is already added), then try again. (" + (e.message || e) + ")", "error");
  }
  finally { $("btnFree").disabled = false; }
});
$("btnJson").addEventListener("click", () => {
  const width = Number($("width").value);
  const height = Number($("height").value);
  if (width % 32 || height % 32) { setStatus("Width and height must be multiples of 32. 720 is illegal; use 736 or 704.", "error"); return; }
  let shots = collectShots();
  if (!shots.length) { $("btnShots").click(); shots = collectShots(); }
  if (!shots.length) { setStatus("Add a story or at least one shot.", "error"); return; }
  const blob = new Blob([JSON.stringify(buildWorkflow(shots), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "minimax_h3_v4_handoff.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Wrote " + shots.length + " shots, " + snapFrames($("seconds").value) + " frames each, " + width + "x" + height + ", " + $("join").value + ".", "ok");
});
loadSettings();
