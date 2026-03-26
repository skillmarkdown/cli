const test = require("node:test");
const assert = require("node:assert/strict");

const { requireDist } = require("../helpers/dist-imports.js");

const { renderTable } = requireDist("lib/shared/table.js");

test("renderTable truncates overflow values and preserves fixed widths", () => {
  const lines = renderTable(
    [
      { header: "NAME", width: 8, value: (row) => row.name },
      { header: "COUNT", width: 5, align: "right", value: (row) => row.count },
    ],
    [{ name: "very-long-skill-name", count: 42 }],
  );

  assert.equal(lines.length, 5);
  assert.equal(lines[0], "┌──────────┬───────┐");
  assert.equal(lines[1], "│ NAME     │ COUNT │");
  assert.equal(lines[2], "├──────────┼───────┤");
  assert.equal(lines[3], "│ very-... │    42 │");
  assert.equal(lines[4], "└──────────┴───────┘");
});

test("renderTable handles null and undefined values as empty cells", () => {
  const lines = renderTable(
    [
      { header: "A", width: 4, value: (row) => row.a },
      { header: "B", width: 4, value: (row) => row.b },
    ],
    [{ a: null, b: undefined }],
  );

  assert.equal(lines[1], "│ A    │ B    │");
  assert.equal(lines[3], "│      │      │");
});

test("renderTable output is deterministic for equivalent input", () => {
  const columns = [
    { header: "COL1", width: 6, value: (row) => row.col1 },
    { header: "COL2", width: 6, value: (row) => row.col2 },
  ];
  const rows = [
    { col1: "a", col2: "b" },
    { col1: "c", col2: "d" },
  ];

  const first = renderTable(columns, rows);
  const second = renderTable(columns, rows);

  assert.deepEqual(first, second);
});

test("renderTable keeps unicode columns aligned and truncates by display width", () => {
  const lines = renderTable(
    [
      { header: "NAME", width: 8, value: (row) => row.name },
      { header: "DESC", width: 8, value: (row) => row.desc },
    ],
    [{ name: "工具", desc: "emoji 😀😀😀😀😀" }],
  );

  assert.equal(lines[3], "│ 工具     │ emoji... │");
});

test("renderTable shrinks low-priority columns when maxWidth is constrained", () => {
  const lines = renderTable(
    [
      {
        header: "A",
        minWidth: 8,
        maxWidth: 20,
        value: () => "aaaaaaaaaaaaaaaa",
        shrinkPriority: 1,
      },
      {
        header: "B",
        minWidth: 8,
        maxWidth: 20,
        value: () => "bbbbbbbbbbbbbbbb",
        shrinkPriority: 5,
      },
    ],
    [{}, {}],
    { maxWidth: 32 },
  );

  // Column shrinking applies to fit maxWidth while preserving table structure.
  assert.match(lines[3], /^│ .*\.{3} .*│ .*\.{3} .*│$/);
});

test("renderTable prefers wrapping on word boundaries before splitting long tokens", () => {
  const lines = renderTable(
    [
      {
        header: "DETAIL",
        width: 24,
        wrap: true,
        maxLines: 4,
        value: () =>
          "Hint: private skills require a Pro plan. Manage your account at https://www.skillmarkdown.com.",
      },
    ],
    [{}],
  );

  const output = lines.join("\n");
  assert.match(output, /Hint: private skills/);
  assert.match(output, /Manage your account at/);
  assert.match(output, /https:\/\/www\.skillm/);
});
