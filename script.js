/* Study Planner: plain JavaScript. Tasks are saved in the browser (localStorage). */

const KEY = "studyplanner.tasks";
const THEME_KEY = "studyplanner.theme";

let tasks = load();      // each task: { id, title, subject, deadline, priority, done }
let filter = "all";      // all | today | pending | overdue | done
let editId = null;       // id of the task being edited (null = adding a new one)

const $ = id => document.getElementById(id);

/* ---------- Saving and loading ---------- */
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(tasks));
}

/* ---------- Small helpers ---------- */
function todayStr() {                       // today's date as YYYY-MM-DD (local time)
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
const isOverdue = t => !t.done && t.deadline < todayStr();
const isToday = t => !t.done && t.deadline === todayStr();
const nice = s => new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function el(tag, cls, text) {               // creates an element; text is added safely (no HTML injection)
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/* ---------- Which tasks to show (filter + search + sort) ---------- */
function visibleTasks() {
  const q = $("search").value.trim().toLowerCase();
  const rank = { high: 0, medium: 1, low: 2 };
  const list = tasks.filter(t =>
    (filter === "all" ||
     (filter === "today" && isToday(t)) ||
     (filter === "pending" && !t.done) ||
     (filter === "overdue" && isOverdue(t)) ||
     (filter === "done" && t.done)) &&
    (t.title + " " + t.subject).toLowerCase().includes(q));

  const sort = $("sort").value;
  list.sort((a, b) =>
    sort === "priority" ? rank[a.priority] - rank[b.priority] || a.deadline.localeCompare(b.deadline)
    : sort === "subject" ? a.subject.localeCompare(b.subject)
    : a.deadline.localeCompare(b.deadline));
  return list;
}

/* ---------- Drawing the screen ---------- */
function renderList() {
  const ul = $("list");
  ul.innerHTML = "";
  const list = visibleTasks();
  $("empty").hidden = list.length > 0;

  for (const t of list) {
    const li = el("li", "task" + (t.done ? " done" : ""));

    const box = el("input");
    box.type = "checkbox";
    box.checked = t.done;
    box.setAttribute("aria-label", "Mark as done");
    box.onchange = () => { t.done = box.checked; save(); render(); };

    const info = el("div");
    info.append(el("strong", "", t.title));
    const meta = el("div", "meta");
    const when = isOverdue(t) ? "Overdue · " + nice(t.deadline) : isToday(t) ? "Due today" : nice(t.deadline);
    meta.append(
      el("span", "chip", t.subject),
      el("span", "tag " + t.priority, t.priority),
      el("span", "when" + (isOverdue(t) ? " late" : isToday(t) ? " now" : ""), when));
    info.append(meta);

    const edit = el("button", "ghost", "Edit");
    edit.onclick = () => startEdit(t.id);
    const del = el("button", "ghost danger", "Delete");
    del.onclick = () => {
      if (!confirm("Delete this task?")) return;
      tasks = tasks.filter(x => x.id !== t.id);
      if (editId === t.id) resetForm();
      save(); render();
    };

    li.append(box, info, edit, del);
    ul.append(li);
  }
}

function renderStats() {
  const done = tasks.filter(t => t.done).length;
  $("s-total").textContent = tasks.length;
  $("s-done").textContent = done;
  $("s-pending").textContent = tasks.length - done;
  $("s-late").textContent = tasks.filter(isOverdue).length;

  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $("pct").textContent = pct + "%";
  $("bar").style.width = pct + "%";

  // progress for every subject
  const bySubject = {};
  tasks.forEach(t => {
    const s = bySubject[t.subject] = bySubject[t.subject] || { total: 0, done: 0 };
    s.total++;
    if (t.done) s.done++;
  });
  const names = Object.keys(bySubject).sort();
  const box = $("subjects");
  box.innerHTML = "";
  $("no-subj").hidden = names.length > 0;
  $("subject-list").innerHTML = "";

  names.forEach(name => {
    const s = bySubject[name], p = Math.round(s.done / s.total * 100);
    const row = el("div", "subj");
    const label = el("div", "row");
    label.append(el("span", "", name), el("span", "", s.done + " / " + s.total + " done (" + p + "%)"));
    const bar = el("div", "bar"), fill = el("i");
    fill.style.width = p + "%";
    bar.append(fill);
    row.append(label, bar);
    box.append(row);

    const option = el("option");           // suggestions while typing a subject
    option.value = name;
    $("subject-list").append(option);
  });
}

function render() {
  renderStats();
  renderList();
}

/* ---------- Add / edit form ---------- */
function showError(msg) { $("error").textContent = msg; }

function resetForm() {
  editId = null;
  $("form").reset();
  $("deadline").value = todayStr();
  $("form-title").textContent = "Add a task";
  $("save").textContent = "Add task";
  $("cancel").hidden = true;
  showError("");
}

function startEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editId = id;
  $("title").value = t.title;
  $("subject").value = t.subject;
  $("deadline").value = t.deadline;
  $("priority").value = t.priority;
  $("form-title").textContent = "Edit task";
  $("save").textContent = "Save changes";
  $("cancel").hidden = false;
  showError("");
  $("title").focus();
  $("form").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("form").onsubmit = e => {
  e.preventDefault();
  const title = $("title").value.trim();
  const subject = $("subject").value.trim() || "General";
  const deadline = $("deadline").value;

  if (!title) return showError("Please enter a task name.");
  if (!deadline) return showError("Please choose a deadline.");

  const data = { title, subject, deadline, priority: $("priority").value };
  if (editId) Object.assign(tasks.find(t => t.id === editId), data);
  else tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), done: false, ...data });

  save();
  resetForm();
  render();
};
$("cancel").onclick = resetForm;

/* ---------- Filters, search, sort ---------- */
document.querySelectorAll("[data-f]").forEach(btn => {
  btn.onclick = () => {
    filter = btn.dataset.f;
    document.querySelectorAll("[data-f]").forEach(b => b.classList.toggle("on", b === btn));
    renderList();
  };
});
$("search").oninput = renderList;
$("sort").onchange = renderList;

/* ---------- Clear completed and download CSV ---------- */
$("clear").onclick = () => {
  if (!tasks.some(t => t.done)) return alert("There are no completed tasks to clear.");
  if (!confirm("Remove all completed tasks?")) return;
  tasks = tasks.filter(t => !t.done);
  save(); render();
};

$("export").onclick = () => {
  if (!tasks.length) return alert("Nothing to download yet.");
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const rows = [["Task", "Subject", "Deadline", "Priority", "Status"]].concat(
    tasks.map(t => [t.title, t.subject, t.deadline, t.priority, t.done ? "Done" : isOverdue(t) ? "Overdue" : "Pending"]));
  const blob = new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "study-planner.csv";
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------- Light / dark mode ---------- */
function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  $("theme").textContent = name === "dark" ? "☀️ Light mode" : "🌙 Dark mode";
  localStorage.setItem(THEME_KEY, name);
}
$("theme").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ---------- Start ---------- */
applyTheme(localStorage.getItem(THEME_KEY) || "light");
resetForm();
render();