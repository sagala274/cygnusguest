requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('network-map');

const params = new URLSearchParams(window.location.search);
const diagramId = params.get('id');
if (!diagramId) window.location.href = 'network-map';

const resultBox = document.getElementById('resultBox');
const nameInput = document.getElementById('diagramName');
const saveStatus = document.getElementById('saveStatus');
const canvasWrap = document.getElementById('canvasWrap');
const svg = document.getElementById('mapCanvas');
const nodesLayer = document.getElementById('nodesLayer');
const edgesLayer = document.getElementById('edgesLayer');

// Pimpinan hanya boleh MELIHAT diagram -- tidak boleh menambah, memindah,
// mengganti warna/label, menghubungkan, menghapus, atau menyimpan.
const user = getUser();
const canEditDiagram = user && ['admin', 'verifikator'].includes(user.role);
if (!canEditDiagram) {
  nameInput.setAttribute('readonly', 'readonly');
  document.getElementById('addPersonBtn').style.display = 'none';
  document.getElementById('addCompanyBtn').style.display = 'none';
  document.getElementById('connectModeBtn').style.display = 'none';
  document.getElementById('saveBtn').style.display = 'none';
  saveStatus.style.display = 'none';
}

// Palet terpisah: kotak/lingkaran pakai warna pastel (teks gelap tetap
// terbaca), garis penghubung pakai warna lebih pekat supaya jelas terlihat
// di atas latar kanvas yang terang.
const NODE_PALETTE = ['#ffffff', '#dbe4ff', '#d1f5df', '#ffe8cc', '#ffd6d6', '#f0d9ff', '#fff3b0', '#d7dbe3'];
const EDGE_PALETTE = ['#172033', '#002878', '#1b7a43', '#c62828', '#92580a', '#7c3aed', '#0891b2', '#667085'];

let state = { nodes: [], edges: [] };
let selected = null; // { type: 'node'|'edge', id }
let connectMode = false;
let connectPendingNodeId = null;
let dragState = null;
let dirty = false;
let loaded = false;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function markDirty() {
  dirty = true;
  saveStatus.textContent = 'Belum disimpan';
  saveStatus.classList.add('is-dirty');
}

function markSaved() {
  dirty = false;
  saveStatus.textContent = 'Tersimpan';
  saveStatus.classList.remove('is-dirty');
}

function genId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function truncateLabel(label, max) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Titik di batas bentuk node, di sepanjang garis dari pusat node menuju
// (toX,toY) -- dipakai supaya garis penghubung berhenti tepat di tepi
// kotak/lingkaran, bukan menembus sampai ke tengah.
function trimToBoundary(node, toX, toY) {
  const dx = toX - node.x;
  const dy = toY - node.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  let t;
  if (node.shape === 'ellipse') {
    t = 1 / Math.sqrt((ux * ux) / (node.rx * node.rx) + (uy * uy) / (node.ry * node.ry) || 1);
  } else {
    const halfW = node.w / 2;
    const halfH = node.h / 2;
    const tx = halfW / Math.max(Math.abs(ux), 1e-6);
    const ty = halfH / Math.max(Math.abs(uy), 1e-6);
    t = Math.min(tx, ty);
  }
  return { x: node.x + ux * t, y: node.y + uy * t };
}

function computeEdgeLine(fromNode, toNode) {
  const start = trimToBoundary(fromNode, toNode.x, toNode.y);
  const end = trimToBoundary(toNode, fromNode.x, fromNode.y);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

function nodeSvg(node) {
  const isSelected = selected && selected.type === 'node' && selected.id === node.id;
  const isPending = connectPendingNodeId === node.id;
  const shapeEl = node.shape === 'ellipse'
    ? `<ellipse class="map-node-shape" rx="${node.rx}" ry="${node.ry}" fill="${node.fill}"></ellipse>`
    : `<rect class="map-node-shape" x="${-node.w / 2}" y="${-node.h / 2}" width="${node.w}" height="${node.h}" rx="8" fill="${node.fill}"></rect>`;
  return `
    <g class="map-node${isSelected ? ' is-selected' : ''}${isPending ? ' is-connect-pending' : ''}" data-node-id="${node.id}" transform="translate(${node.x},${node.y})">
      <title>${escapeHtml(node.label)}</title>
      ${shapeEl}
      <text class="map-node-label">${escapeHtml(truncateLabel(node.label, 18))}</text>
    </g>
  `;
}

function edgeSvg(edge) {
  const fromNode = state.nodes.find((n) => n.id === edge.from);
  const toNode = state.nodes.find((n) => n.id === edge.to);
  if (!fromNode || !toNode) return '';
  const { x1, y1, x2, y2 } = computeEdgeLine(fromNode, toNode);
  const isSelected = selected && selected.type === 'edge' && selected.id === edge.id;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const shortLabel = edge.label ? truncateLabel(edge.label, 24) : '';
  const labelWidth = shortLabel ? Math.max(24, shortLabel.length * 6.5 + 10) : 0;
  return `
    <g class="map-edge-group" data-edge-id="${edge.id}">
      <title>${escapeHtml(edge.label || '')}</title>
      <line class="map-edge${isSelected ? ' is-selected' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${edge.color}" marker-end="url(#arrowHead)"></line>
      <line class="map-edge-hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>
      ${shortLabel ? `<rect class="map-edge-label-bg" x="${midX - labelWidth / 2}" y="${midY - 9}" width="${labelWidth}" height="16" rx="3"></rect><text class="map-edge-label" x="${midX}" y="${midY + 3}">${escapeHtml(shortLabel)}</text>` : ''}
    </g>
  `;
}

function renderAll() {
  edgesLayer.innerHTML = state.edges.map(edgeSvg).join('');
  nodesLayer.innerHTML = state.nodes.map(nodeSvg).join('');
}

function updateConnectedEdges(nodeId) {
  state.edges.forEach((edge) => {
    if (edge.from !== nodeId && edge.to !== nodeId) return;
    const fromNode = state.nodes.find((n) => n.id === edge.from);
    const toNode = state.nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) return;
    const { x1, y1, x2, y2 } = computeEdgeLine(fromNode, toNode);
    const group = edgesLayer.querySelector(`[data-edge-id="${edge.id}"]`);
    if (!group) return;
    group.querySelectorAll('line').forEach((line) => {
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
    });
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const labelText = group.querySelector('.map-edge-label');
    const labelBg = group.querySelector('.map-edge-label-bg');
    if (labelText) {
      labelText.setAttribute('x', midX);
      labelText.setAttribute('y', midY + 3);
    }
    if (labelBg) {
      const w = parseFloat(labelBg.getAttribute('width'));
      labelBg.setAttribute('x', midX - w / 2);
      labelBg.setAttribute('y', midY - 9);
    }
  });
}

// Sengaja TIDAK memanggil renderAll() (yang membongkar-pasang seluruh DOM
// SVG) hanya untuk perubahan seleksi -- cukup toggle class "is-selected"
// pada elemen yang bersangkutan. Ini penting supaya klik dua kali (dobel
// klik) untuk ganti label tetap terdeteksi browser sebagai satu rangkaian
// dblclick: kalau DOM node-nya sempat dibongkar-pasang di antara klik
// pertama dan kedua (akibat renderAll()), sebagian browser gagal
// mengenali itu sebagai dblclick pada elemen yang sama.
function elementDomFor(sel) {
  if (!sel) return null;
  return sel.type === 'node'
    ? nodesLayer.querySelector(`[data-node-id="${sel.id}"]`)
    : edgesLayer.querySelector(`[data-edge-id="${sel.id}"] .map-edge`);
}

function selectElement(type, id) {
  const prev = selected;
  selected = { type, id };
  connectPendingNodeId = null;
  const prevEl = elementDomFor(prev);
  if (prevEl) prevEl.classList.remove('is-selected');
  const nextEl = elementDomFor(selected);
  if (nextEl) nextEl.classList.add('is-selected');
  updateToolbarForSelection();
}

function deselect() {
  if (!selected) return;
  const prevEl = elementDomFor(selected);
  if (prevEl) prevEl.classList.remove('is-selected');
  selected = null;
  updateToolbarForSelection();
}

function updateToolbarForSelection() {
  const colorGroup = document.getElementById('colorGroup');
  const selectionActions = document.getElementById('selectionActions');
  if (!selected || !canEditDiagram) {
    colorGroup.style.display = 'none';
    selectionActions.style.display = 'none';
    return;
  }
  colorGroup.style.display = 'flex';
  selectionActions.style.display = 'flex';

  const palette = selected.type === 'node' ? NODE_PALETTE : EDGE_PALETTE;
  const currentColor = selected.type === 'node'
    ? (state.nodes.find((n) => n.id === selected.id) || {}).fill
    : (state.edges.find((e) => e.id === selected.id) || {}).color;

  document.getElementById('colorSwatches').innerHTML = palette
    .map((c) => `<button type="button" class="map-color-swatch${c === currentColor ? ' is-selected' : ''}" style="background:${c};" data-color="${c}" title="${c}"></button>`)
    .join('');

  document.querySelectorAll('.map-color-swatch').forEach((btn) => {
    btn.addEventListener('click', () => applyColor(btn.dataset.color));
  });
}

function applyColor(color) {
  if (!selected || !canEditDiagram) return;
  if (selected.type === 'node') {
    const node = state.nodes.find((n) => n.id === selected.id);
    if (node) node.fill = color;
  } else {
    const edge = state.edges.find((e) => e.id === selected.id);
    if (edge) edge.color = color;
  }
  markDirty();
  renderAll();
  updateToolbarForSelection();
}

function deleteSelected() {
  if (!selected || !canEditDiagram) return;
  if (selected.type === 'node') {
    state.nodes = state.nodes.filter((n) => n.id !== selected.id);
    state.edges = state.edges.filter((e) => e.from !== selected.id && e.to !== selected.id);
  } else {
    state.edges = state.edges.filter((e) => e.id !== selected.id);
  }
  selected = null;
  markDirty();
  renderAll();
  updateToolbarForSelection();
}

function editNodeLabel(node) {
  if (!canEditDiagram) return;
  const g = nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
  if (!g) return;
  const shapeRect = g.querySelector('.map-node-shape').getBoundingClientRect();
  openInlineEditor(node.label, shapeRect, (value) => {
    node.label = value.trim() || node.label;
    markDirty();
    renderAll();
  });
}

function editEdgeLabel(edge) {
  if (!canEditDiagram) return;
  const group = edgesLayer.querySelector(`[data-edge-id="${edge.id}"]`);
  if (!group) return;
  const lineRect = group.querySelector('.map-edge').getBoundingClientRect();
  const fakeRect = {
    left: lineRect.left + lineRect.width / 2 - 60,
    top: lineRect.top + lineRect.height / 2 - 12,
    width: 120,
    height: 24,
  };
  openInlineEditor(edge.label || '', fakeRect, (value) => {
    edge.label = value.trim();
    markDirty();
    renderAll();
  });
}

function openInlineEditor(initialValue, rect, onCommit) {
  document.querySelectorAll('.map-inline-editor').forEach((el) => el.remove());
  const input = document.createElement('input');
  input.className = 'map-inline-editor';
  input.value = initialValue;
  input.style.left = `${rect.left}px`;
  input.style.top = `${rect.top + rect.height / 2 - 14}px`;
  input.style.width = `${Math.max(80, rect.width)}px`;
  document.body.appendChild(input);
  input.focus();
  input.select();

  let committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    onCommit(input.value);
    input.remove();
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { committed = true; input.remove(); }
  });
  input.addEventListener('blur', commit);
}

function addNode(shape, defaultLabel) {
  if (!canEditDiagram) return;
  const node = {
    id: genId('n'),
    shape,
    x: canvasWrap.scrollLeft + 220 + Math.random() * 60,
    y: canvasWrap.scrollTop + 160 + Math.random() * 60,
    w: 140,
    h: 60,
    rx: 75,
    ry: 38,
    label: defaultLabel,
    fill: shape === 'ellipse' ? '#dbe4ff' : '#ffffff',
  };
  state.nodes.push(node);
  markDirty();
  renderAll();
  selectElement('node', node.id);
  setTimeout(() => editNodeLabel(node), 30);
}

function onNodeMouseDown(e, node) {
  e.stopPropagation();
  if (connectMode) {
    handleConnectClick(node.id);
    return;
  }
  selectElement('node', node.id);
  if (!canEditDiagram) return;
  dragState = {
    nodeId: node.id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    origX: node.x,
    origY: node.y,
  };
}

function handleConnectClick(nodeId) {
  if (!canEditDiagram) return;
  if (!connectPendingNodeId) {
    connectPendingNodeId = nodeId;
    renderAll();
    return;
  }
  if (connectPendingNodeId === nodeId) {
    connectPendingNodeId = null;
    renderAll();
    return;
  }
  const edge = { id: genId('e'), from: connectPendingNodeId, to: nodeId, label: '', color: '#667085' };
  state.edges.push(edge);
  connectPendingNodeId = null;
  markDirty();
  renderAll();
}

nodesLayer.addEventListener('mousedown', (e) => {
  const g = e.target.closest('.map-node');
  if (!g) return;
  const node = state.nodes.find((n) => n.id === g.dataset.nodeId);
  if (node) onNodeMouseDown(e, node);
});

nodesLayer.addEventListener('dblclick', (e) => {
  const g = e.target.closest('.map-node');
  if (!g) return;
  const node = state.nodes.find((n) => n.id === g.dataset.nodeId);
  if (node) editNodeLabel(node);
});

edgesLayer.addEventListener('click', (e) => {
  const g = e.target.closest('.map-edge-group');
  if (!g) return;
  e.stopPropagation();
  selectElement('edge', g.dataset.edgeId);
});

edgesLayer.addEventListener('dblclick', (e) => {
  const g = e.target.closest('.map-edge-group');
  if (!g) return;
  const edge = state.edges.find((ed) => ed.id === g.dataset.edgeId);
  if (edge) editEdgeLabel(edge);
});

svg.addEventListener('mousedown', (e) => {
  if (e.target !== svg) return;
  if (connectPendingNodeId) {
    connectPendingNodeId = null;
    renderAll();
    return;
  }
  deselect();
});

document.addEventListener('mousemove', (e) => {
  if (!dragState) return;
  const node = state.nodes.find((n) => n.id === dragState.nodeId);
  if (!node) return;
  node.x = dragState.origX + (e.clientX - dragState.startClientX);
  node.y = dragState.origY + (e.clientY - dragState.startClientY);
  const g = nodesLayer.querySelector(`[data-node-id="${node.id}"]`);
  if (g) g.setAttribute('transform', `translate(${node.x},${node.y})`);
  updateConnectedEdges(node.id);
});

document.addEventListener('mouseup', () => {
  if (dragState) {
    const node = state.nodes.find((n) => n.id === dragState.nodeId);
    if (node && (node.x !== dragState.origX || node.y !== dragState.origY)) {
      markDirty();
    }
    dragState = null;
  }
});

document.getElementById('addPersonBtn').addEventListener('click', () => addNode('ellipse', 'Nama Orang'));
document.getElementById('addCompanyBtn').addEventListener('click', () => addNode('rect', 'Nama Perusahaan'));

document.getElementById('connectModeBtn').addEventListener('click', () => {
  connectMode = !connectMode;
  connectPendingNodeId = null;
  document.getElementById('connectModeBtn').classList.toggle('is-active', connectMode);
  document.getElementById('connectHint').style.display = connectMode ? 'inline' : 'none';
  svg.classList.toggle('is-connect-mode', connectMode);
  renderAll();
});

document.getElementById('deleteElementBtn').addEventListener('click', deleteSelected);
document.getElementById('renameElementBtn').addEventListener('click', () => {
  if (!selected) return;
  if (selected.type === 'node') {
    const node = state.nodes.find((n) => n.id === selected.id);
    if (node) editNodeLabel(node);
  } else {
    const edge = state.edges.find((e) => e.id === selected.id);
    if (edge) editEdgeLabel(edge);
  }
});

document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (canEditDiagram && (e.key === 'Delete' || e.key === 'Backspace') && selected) {
    e.preventDefault();
    deleteSelected();
  }
});

nameInput.addEventListener('input', markDirty);

async function save() {
  if (!canEditDiagram) return;
  resultBox.style.display = 'none';
  try {
    await api(`/network-diagrams/${diagramId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: nameInput.value.trim() || 'Tanpa Nama',
        data: JSON.stringify({ nodes: state.nodes, edges: state.edges }),
      }),
    });
    markSaved();
  } catch (err) {
    showMessage(err.message, true);
  }
}
document.getElementById('saveBtn').addEventListener('click', save);

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

async function load() {
  try {
    const res = await api(`/network-diagrams/${diagramId}`);
    nameInput.value = res.data.name;
    let parsed = { nodes: [], edges: [] };
    try {
      parsed = JSON.parse(res.data.data || '{"nodes":[],"edges":[]}');
    } catch (err) {
      parsed = { nodes: [], edges: [] };
    }
    state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    state.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    renderAll();
    loaded = true;
  } catch (err) {
    showMessage(err.message, true);
  }
}

load();
