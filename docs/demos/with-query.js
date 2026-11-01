import df$ from "defuss-query";

// df$ is defuss-morph's jQuery-shaped facade: every .html() is a morph
const tags = ["morph", "query"];
const list = df$("[data-ref=tag-list]");

// VNodes carry the user's text as text: nothing is parsed as HTML
const render = () =>
  list.html(tags.map((tag) => ({ type: "li", attributes: { key: tag, class: "badge", "data-variant": "secondary" }, children: [tag] })));

export function mountWithQuery() {
  render();
  df$("[data-ref=tag-form]").on("submit", function (event) {
    event.preventDefault();
    const tag = String(df$(this).form().get("tag") ?? "").trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
    df$(this).find("input").val("");
    render();
  });
}
