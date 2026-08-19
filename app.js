const STORAGE_KEY = "eisenhower-tasks";

const QUADRANTS = ["do", "schedule", "delegate", "eliminate"];

/** @type {{ id: string, title: string, notes: string, quadrant: string, done: boolean, createdAt: number }[]} */
let tasks = [];

let editingId = null;
let draggedTaskId = null;

let selectedQuadrant = "do";

const mobileQuery = window.matchMedia("(max-width: 768px)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

const modal = document.getElementById("task-modal");
const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const notesInput = document.getElementById("task-notes");
const quickAddInput = document.getElementById("quick-add-input");

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
  return crypto.randomUUID();
}

function getQuadrantRadio(value) {
  return form.querySelector(`input[name="quadrant"][value="${value}"]`);
}

function isMobileLayout() {
  return mobileQuery.matches;
}

function isTouchDevice() {
  return coarsePointerQuery.matches;
}

function selectQuadrant(quadrant) {
  selectedQuadrant = quadrant;

  document.querySelectorAll(".quadrant-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.quadrant === quadrant);
  });

  document.querySelectorAll(".quadrant").forEach((el) => {
    el.classList.toggle("is-visible", el.dataset.quadrant === quadrant);
  });
}

function addTask(title, quadrant, notes = "") {
  const trimmed = title.trim();
  if (!trimmed) return false;

  tasks.push({
    id: generateId(),
    title: trimmed,
    notes,
    quadrant,
    done: false,
    createdAt: Date.now(),
  });
  saveTasks();
  render();
  return true;
}

function openEditModal(task) {
  editingId = task.id;
  titleInput.value = task.title;
  notesInput.value = task.notes;
  getQuadrantRadio(task.quadrant).checked = true;
  modal.showModal();
  titleInput.focus();
}

function closeModal() {
  modal.close();
  editingId = null;
  form.reset();
}

function upsertTask(data) {
  const index = tasks.findIndex((t) => t.id === editingId);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...data };
    saveTasks();
    if (data.quadrant) selectQuadrant(data.quadrant);
    render();
  }
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
}

function toggleDone(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    saveTasks();
    render();
  }
}

function moveTask(id, quadrant) {
  const task = tasks.find((t) => t.id === id);
  if (task && task.quadrant !== quadrant) {
    task.quadrant = quadrant;
    saveTasks();
    render();
  }
}

function createTaskElement(task) {
  const li = document.createElement("li");
  li.className = `task-card${task.done ? " done" : ""}`;
  li.draggable = !isTouchDevice();
  li.dataset.id = task.id;

  li.addEventListener("dragstart", (e) => {
    draggedTaskId = task.id;
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  });

  li.addEventListener("dragend", () => {
    draggedTaskId = null;
    li.classList.remove("dragging");
    document.querySelectorAll(".quadrant.drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.done;
  checkbox.addEventListener("change", () => toggleDone(task.id));

  const body = document.createElement("div");
  body.className = "task-body";

  const titleEl = document.createElement("div");
  titleEl.className = "task-title";
  titleEl.textContent = task.title;
  body.appendChild(titleEl);
  body.addEventListener("click", () => openEditModal(task));

  if (task.notes) {
    const notesEl = document.createElement("div");
    notesEl.className = "task-notes";
    notesEl.textContent = task.notes;
    body.appendChild(notesEl);
  }

  const actions = document.createElement("div");
  actions.className = "task-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "task-action-btn";
  editBtn.title = "Edit";
  editBtn.textContent = "✎";
  editBtn.addEventListener("click", () => openEditModal(task));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "task-action-btn delete";
  deleteBtn.title = "Delete";
  deleteBtn.textContent = "✕";
  deleteBtn.addEventListener("click", () => deleteTask(task.id));

  actions.append(editBtn, deleteBtn);
  li.append(checkbox, body, actions);
  return li;
}

function render() {
  QUADRANTS.forEach((q) => {
    const list = document.getElementById(`list-${q}`);
    list.innerHTML = "";

    const quadrantTasks = tasks
      .filter((t) => t.quadrant === q)
      .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt);

    quadrantTasks.forEach((task) => {
      list.appendChild(createTaskElement(task));
    });

    const countEl = document.querySelector(`[data-count-for="${q}"]`);
    const active = quadrantTasks.filter((t) => !t.done).length;
    countEl.textContent = active;
  });

  const activeTotal = tasks.filter((t) => !t.done).length;
  const doneTotal = tasks.filter((t) => t.done).length;
  document.getElementById("stats-active").textContent =
    `${activeTotal} active task${activeTotal === 1 ? "" : "s"}`;
  document.getElementById("stats-done").textContent =
    `${doneTotal} completed`;
}

function setupDragAndDrop() {
  document.querySelectorAll(".quadrant").forEach((quadrant) => {
    quadrant.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      quadrant.classList.add("drag-over");
    });

    quadrant.addEventListener("dragleave", (e) => {
      if (!quadrant.contains(e.relatedTarget)) {
        quadrant.classList.remove("drag-over");
      }
    });

    quadrant.addEventListener("drop", (e) => {
      e.preventDefault();
      quadrant.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain") || draggedTaskId;
      if (id) {
        moveTask(id, quadrant.dataset.quadrant);
      }
    });
  });
}

function setupQuickAdd() {
  document.querySelectorAll(".quadrant-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectQuadrant(chip.dataset.quadrant);
    });
  });

  function submitQuickAdd() {
    if (addTask(quickAddInput.value, selectedQuadrant)) {
      quickAddInput.value = "";
      quickAddInput.focus();
    }
  }

  document.getElementById("quick-add-btn").addEventListener("click", submitQuickAdd);

  quickAddInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitQuickAdd();
    }
  });
}

function setupInlineAdd() {
  document.querySelectorAll(".inline-add").forEach((formEl) => {
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = formEl.querySelector("input");
      const quadrant = formEl.dataset.quadrant;
      if (addTask(input.value, quadrant)) {
        input.value = "";
      }
    });
  });
}

document.getElementById("close-modal").addEventListener("click", closeModal);
document.getElementById("cancel-btn").addEventListener("click", closeModal);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const quadrant = form.querySelector('input[name="quadrant"]:checked').value;
  upsertTask({ title, notes: notesInput.value.trim(), quadrant });
  closeModal();
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

function setupMobileSwipe() {
  const matrix = document.getElementById("matrix");
  let startX = 0;
  let startY = 0;

  matrix.addEventListener(
    "touchstart",
    (e) => {
      const touch = e.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true }
  );

  matrix.addEventListener(
    "touchend",
    (e) => {
      if (!isMobileLayout()) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return;

      const index = QUADRANTS.indexOf(selectedQuadrant);
      const next = dx < 0 ? index + 1 : index - 1;
      if (QUADRANTS[next]) selectQuadrant(QUADRANTS[next]);
    },
    { passive: true }
  );
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

loadTasks();
selectQuadrant(selectedQuadrant);
setupQuickAdd();
setupInlineAdd();
setupDragAndDrop();
setupMobileSwipe();
setupServiceWorker();
mobileQuery.addEventListener("change", () => selectQuadrant(selectedQuadrant));
render();
