import df$ from "defuss-query";

// the page's markup names its parts with data-ref; one selection per part
// is the HTML counterpart of createRef()
const ui = {
  filter: df$("[data-ref=lang-filter]"),
  list: df$("[data-ref=lang-list]"),
  count: df$("[data-ref=lang-count]"),
};

// the server-rendered items are the data
const languages = ui.list.find("li").map((li) => ({ key: li.getAttribute("key"), name: li.textContent }));
const esc = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const mountQueryRefs = () =>
  ui.filter.on("input", function () {
    const query = this.value.trim().toLowerCase();
    const shown = languages.filter((lang) => lang.name.toLowerCase().includes(query));
    // .html() morphs: items that stay are the same nodes, in place
    ui.list.html(shown.map((lang) => `<li key="${lang.key}">${esc(lang.name)}</li>`).join(""));
    ui.count.text(`${shown.length} of ${languages.length}`);
  });
