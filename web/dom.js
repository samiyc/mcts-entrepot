/** Elements for the page (app.js, split on 26/10/2026): HTML with its attributes, and SVG for the board. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

export function svg(tag, attrs = {}, text = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== null) node.textContent = text;
  return node;
}

/** A form's fields are replaced whole when they change, never patched: their value may be the user's, not their attribute's. */
const FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);
const isElement = (node) => node.nodeType === Node.ELEMENT_NODE;
const same = (old, next) => old.nodeType === next.nodeType && (isElement(old) ? old.outerHTML === next.outerHTML : old.nodeValue === next.nodeValue);
const alike = (old, next) => isElement(old) && isElement(next) && old.namespaceURI === next.namespaceURI && old.tagName === next.tagName && !FIELDS.has(old.tagName);

/** `next`'s attributes on `old`; a `<details>` the user opened stays open. */
function patchAttributes(old, next) {
  for (const { name } of [...old.attributes]) if (!next.hasAttribute(name) && !(name === "open" && old.tagName === "DETAILS")) old.removeAttribute(name);
  for (const { name, value } of next.attributes) if (old.getAttribute(name) !== value) old.setAttribute(name, value);
}

function patchNode(old, next) {
  if (same(old, next)) return;
  if (!alike(old, next)) {
    old.replaceWith(next);
    return;
  }
  patchAttributes(old, next);
  patchChildren(old, [...next.childNodes]);
}

/**
 * Puts `nodes` in `parent` in place of its children, keeping each one that is already the same, patching the others
 * (Sami, 29/10/2026: while a simulation played, every turn rebuilt the side panel; the button under the mouse was a new
 * one each time, its hover flickered, and a click on « Pause » was lost, the button pressed gone before it was let go).
 */
export function patchChildren(parent, nodes) {
  const old = [...parent.childNodes];
  nodes.forEach((node, i) => (old[i] ? patchNode(old[i], node) : parent.append(node)));
  for (const extra of old.slice(nodes.length)) extra.remove();
}
