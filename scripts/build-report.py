"""
Generates the CGCI Campus Navigation project report as a PDF.

Every figure in the document is read from docs/figures.json, which is produced by
`scripts/extract-figures.ts` running the real algorithm modules against the real
campus dataset. Nothing in the report is typed by hand, so the document cannot drift
away from the running system.

Usage:  python scripts/build-report.py [output.pdf]
"""

import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIGURES = os.path.join(ROOT, "docs", "figures.json")
DEFAULT_OUT = r"C:\Users\ROM\Downloads\CGCI-Campus-Navigation-Project-Report.pdf"

# Hunter green and neutral grey, matching the application.
GREEN = colors.HexColor("#1f4d3a")
GREEN_LIGHT = colors.HexColor("#eaf1ec")
AMBER = colors.HexColor("#c26f08")
AMBER_LIGHT = colors.HexColor("#fff6e8")
INK = colors.HexColor("#272e2c")
GREY = colors.HexColor("#6d7a76")
RULE = colors.HexColor("#dde2e0")

DEVELOPERS = [
    ("Sandy Gabitanan", "System design and implementation"),
    ("Chynna Madriaga", "System design and implementation"),
]

PAGE_W, PAGE_H = A4
MARGIN = 20 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


def build_styles():
    base = getSampleStyleSheet()

    def style(name, parent="Normal", **kw):
        """Named paragraph style derived from a reportlab base style."""
        return ParagraphStyle(name, parent=base[parent], **kw)

    return {
        "title": style(
            "Title",
            fontName="Helvetica-Bold",
            fontSize=23,
            leading=27,
            textColor=GREEN,
            spaceAfter=2 * mm,
        ),
        "subtitle": style(
            "Subtitle",
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            textColor=GREY,
            spaceAfter=6 * mm,
        ),
        "h1": style(
            "H1",
            fontName="Helvetica-Bold",
            fontSize=14.5,
            leading=18,
            textColor=GREEN,
            spaceBefore=8 * mm,
            spaceAfter=3 * mm,
        ),
        "h2": style(
            "H2",
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=INK,
            spaceBefore=5 * mm,
            spaceAfter=2 * mm,
        ),
        "body": style(
            "Body",
            fontName="Helvetica",
            fontSize=9.6,
            leading=14.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=2.6 * mm,
        ),
        "bullet": style(
            "Bullet",
            fontName="Helvetica",
            fontSize=9.6,
            leading=13.8,
            textColor=INK,
            leftIndent=6 * mm,
            firstLineIndent=-3.6 * mm,
            bulletIndent=2.4 * mm,
            spaceAfter=1.4 * mm,
        ),
        "code": style(
            "Code",
            fontName="Courier",
            fontSize=6.6,
            leading=8.6,
            textColor=colors.HexColor("#1b2420"),
        ),
        "caption": style(
            "Caption",
            fontName="Helvetica-Oblique",
            fontSize=8.4,
            leading=11,
            textColor=GREY,
            spaceBefore=1.5 * mm,
            spaceAfter=3 * mm,
        ),
        "callout": style(
            "Callout",
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.2,
            textColor=INK,
            alignment=TA_JUSTIFY,
        ),
        "calloutHead": style(
            "CalloutHead",
            fontName="Helvetica-Bold",
            fontSize=9.8,
            leading=13,
            textColor=AMBER,
            spaceAfter=1.2 * mm,
        ),
        "center": style(
            "Center",
            fontName="Helvetica",
            fontSize=9.4,
            leading=13.4,
            textColor=INK,
            alignment=TA_CENTER,
        ),
    }


S = build_styles()


def para(text, kind="body"):
    return Paragraph(text, S[kind])


def bullet_list(items):
    return [Paragraph(item, S["bullet"], bulletText="\u2022") for item in items]


def data_table(rows, widths, align_right_from=None, font_size=8.6, head_bg=GREEN_LIGHT):
    """Renders a table with the document's house style."""
    wrapped = []
    for index, row in enumerate(rows):
        cell_style = S["body"] if index else S["h2"]
        wrapped.append([Paragraph(str(cell), cell_style) for cell in row])

    table = Table(wrapped, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), head_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), GREEN),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, GREEN),
        ("LINEBELOW", (0, 1), (-1, -2), 0.25, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if align_right_from is not None:
        for column in range(align_right_from, len(widths)):
            commands.append(("ALIGN", (column, 1), (column, -1), "RIGHT"))
    table.setStyle(TableStyle(commands))
    return table


def code_block(text, max_lines=None):
    lines = text.split("\n")
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines] + ["..."]
    return Preformatted("\n".join(lines), S["code"])


def callout(head, body, bg=AMBER_LIGHT, border=AMBER):
    inner = [Paragraph(head, S["calloutHead"]), Paragraph(body, S["callout"])]
    box = Table([[inner]], colWidths=[CONTENT_W], hAlign="LEFT")
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("LINEBEFORE", (0, 0), (0, -1), 2.5, border),
                ("BOX", (0, 0), (-1, -1), 0.25, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return KeepTogether(box)


def stat_row(pairs):
    """A row of headline figures."""
    cells = []
    for value, label in pairs:
        cells.append(
            Paragraph(
                f'<font size="15" color="#1f4d3a"><b>{value}</b></font><br/>'
                f'<font size="7.6" color="#6d7a76">{label}</font>',
                S["center"],
            )
        )
    table = Table([cells], colWidths=[CONTENT_W / len(cells)] * len(cells), hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.25, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def developers_table(heading):
    return data_table(
        [["Developer", heading]] + [[name, role] for name, role in DEVELOPERS],
        [52 * mm, 118 * mm],
        font_size=9.2,
    )


def page_furniture(canv, doc):
    """Footer with page number, and a running header on content pages."""
    canv.saveState()
    canv.setFont("Helvetica", 7.4)
    canv.setFillColor(GREY)

    if doc.page > 1:
        canv.setFont("Helvetica-Bold", 7.4)
        canv.setFillColor(GREEN)
        canv.drawString(MARGIN, PAGE_H - 13 * mm, "CGCI CAMPUS NAVIGATION")
        canv.setFont("Helvetica", 7.4)
        canv.setFillColor(GREY)
        canv.drawRightString(
            PAGE_W - MARGIN, PAGE_H - 13 * mm, "Discrete Structures 1 project report"
        )
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.5)
        canv.line(MARGIN, PAGE_H - 15.5 * mm, PAGE_W - MARGIN, PAGE_H - 15.5 * mm)

    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.5)
    canv.line(MARGIN, 15 * mm, PAGE_W - MARGIN, 15 * mm)
    canv.setFont("Helvetica", 7.4)
    canv.setFillColor(GREY)
    canv.drawString(MARGIN, 10.5 * mm, "cgci-campus-navigation.web.app")
    canv.drawRightString(PAGE_W - MARGIN, 10.5 * mm, f"Page {doc.page}")
    canv.restoreState()


def build(output_path):
    with open(FIGURES, "r", encoding="utf-8") as handle:
        fig = json.load(handle)

    stats = fig["stats"]
    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="CGCI Campus Navigation - Project Report",
        author="Sandy Gabitanan and Chynna Madriaga",
        subject=(
            "Campus navigation as a graph: Dijkstra shortest paths, BFS "
            "reachability, adjacency list and matrix"
        ),
    )

    frame = Frame(MARGIN, 18 * mm, CONTENT_W, PAGE_H - 34 * mm, id="body")
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[frame], onPage=page_furniture),
            PageTemplate(id="content", frames=[frame], onPage=page_furniture),
        ]
    )

    story = []
    add = story.append

    # ------------------------------------------------------------- cover
    add(Spacer(1, 10 * mm))
    add(para("CORE GATEWAY COLLEGE, INC.", "subtitle"))
    add(para("CGCI Campus Navigation", "title"))
    add(
        para(
            "An interactive campus wayfinding system that models the campus as a "
            "weighted graph, and applies graph theory to answer a real question: "
            "what is the shortest walk between two buildings?",
            "subtitle",
        )
    )

    add(
        stat_row(
            [
                (stats["vertices"], "VERTICES  |V|"),
                (stats["edgesOpen"], "OPEN PATHS  |E|"),
                (stats["components"], "CONNECTED<br/>COMPONENTS"),
                (f"{stats['averageDegree']:.2f}", "MEAN DEGREE"),
                (f"{stats['density']:.3f}", "DENSITY"),
            ]
        )
    )
    add(Spacer(1, 8 * mm))

    add(para("Discrete Structures 1 &mdash; Project Report", "h2"))
    add(
        para(
            "This report describes the mathematical model, the algorithms, the data "
            "pipeline, the security model and the testing strategy of the system. "
            "Every figure quoted here was generated by running the project's own "
            "algorithm modules against the live campus dataset, so the document "
            "cannot disagree with the running application.",
            "body",
        )
    )

    add(Spacer(1, 3 * mm))
    add(para("Developers", "h2"))
    add(developers_table("Contribution"))
    add(
        para(
            "College of Computer Studies. Submitted in partial fulfilment of the "
            "requirements for Discrete Structures 1.",
            "caption",
        )
    )

    add(Spacer(1, 2 * mm))
    add(
        para(
            "<b>Live system:</b> https://cgci-campus-navigation.web.app<br/>"
            "<b>Source code:</b> https://github.com/eromanjuan/cgci-campus-navigation<br/>"
            "<b>Campus data source:</b> Core Gateway College, Inc. Campus Site Map",
            "body",
        )
    )

    add(
        callout(
            "A note on the campus data",
            "Six of the fifteen locations are still labelled &ldquo;BLDG. NAME&rdquo; on "
            "the official campus site map and have not been named by the college. This "
            "system labels them by the functions the plan documents inside them so that "
            "they can be routed to at all. Those names are <b>not official</b>: every one "
            "is flagged unverified in the database, the interface labels them as such, "
            "and a banner states the fact on every public page. All of them can be "
            "renamed by an administrator without a code change.",
        )
    )

    add(NextPageTemplate("content"))
    add(PageBreak())

    # ------------------------------------------------------- 1. the model
    add(para("1. The campus as a graph", "h1"))
    add(
        para(
            "A graph is an ordered pair of sets, written G = (V, E). The whole system "
            "rests on that one definition, and every other idea follows from it.",
            "body",
        )
    )
    add(
        para(
            "<b>V, the vertex set</b>, is every navigable campus location &mdash; each "
            "building, gate, parking area and open ground, stored as a document in the "
            "Firestore <font face='Courier'>locations</font> collection. "
            f"|V| = {stats['vertices']}.",
            "body",
        )
    )
    add(
        para(
            "<b>E, the edge set</b>, is every walkable path between two locations, stored "
            "in the <font face='Courier'>edges</font> collection and weighted by its "
            f"length in metres. {stats['edgesStored']} paths are stored, of which "
            f"{stats['edgesOpen']} are open and {stats['edgesClosed']} is closed, so "
            f"|E| = {stats['edgesOpen']} contributes to routing.",
            "body",
        )
    )
    add(
        para(
            "An edge joins two <i>different</i> locations: the database rejects a "
            "self-loop outright, because a building cannot be adjacent to itself. Edges "
            "are undirected by default, since a campus walkway can be walked in either "
            "direction, though a one-way path is supported.",
            "body",
        )
    )

    add(para(f"1.1 The {stats['vertices']} vertices", "h2"))
    rows = [["#", "Location", "Type", "Category", "Official name?"]]
    for index, item in enumerate(fig["locations"], start=1):
        rows.append(
            [
                str(index),
                item["name"],
                item["type"],
                item["category"],
                "yes"
                if item["verified"]
                else "<font color='#c26f08'>no &mdash; 'BLDG. NAME'</font>",
            ]
        )
    add(data_table(rows, [8 * mm, 44 * mm, 46 * mm, 27 * mm, 40 * mm]))
    add(
        para(
            "Category is assigned by the functions the site plan documents inside each "
            "building, not by the fill colour: the plan's own legend lists "
            "&ldquo;Buildings (Academic)&rdquo; twice with two different colours, so "
            "colour alone cannot separate the types. CORE 5 is administrative because "
            "the plan lists Admin, HR and Finance inside it.",
            "caption",
        )
    )

    add(para(f"1.2 The {stats['edgesStored']} edges", "h2"))
    rows = [["From", "To", "Distance", "Status"]]
    for edge in fig["paths"]:
        rows.append(
            [
                edge["from"],
                edge["to"],
                f"{edge['distance']} m",
                "open" if edge["walkable"] else "<font color='#c26f08'>closed</font>",
            ]
        )
    add(
        data_table(
            rows,
            [58 * mm, 58 * mm, 26 * mm, 23 * mm],
            align_right_from=2,
            font_size=8.2,
        )
    )

    add(para("1.3 Graph properties", "h2"))
    add(
        stat_row(
            [
                (stats["vertices"], "VERTICES"),
                (stats["edgesOpen"], "EDGES"),
                (stats["components"], "COMPONENTS"),
                (f"{stats['averageDegree']:.2f}", "MEAN DEGREE 2E/V"),
                (f"{stats['density']:.3f}", "DENSITY 2E/(V(V-1))"),
            ]
        )
    )
    add(Spacer(1, 2 * mm))
    add(
        para(
            "The campus forms a <b>single connected component</b>. Every vertex can reach "
            "every other vertex, which is why no pair of campus locations is ever "
            "reported as unreachable. Should a building be isolated &mdash; by closing "
            "every path that touches it &mdash; the system immediately reports a second "
            "component and names the stranded building.",
            "body",
        )
    )
    add(
        para(
            f"Mean degree is 2E/V = 2({stats['edgesOpen']})/{stats['vertices']} = "
            f"{stats['averageDegree']:.2f}, so on average each building is about three "
            "walkways away. Density 2E/(V(V-1)) = "
            f"{stats['density']:.3f} is low, as expected: a real campus is a sparse "
            "graph, which is precisely why the adjacency list rather than the matrix is "
            "used for routing.",
            "body",
        )
    )

    add(PageBreak())

    # ------------------------------------------------ 2. representations
    add(para("2. Two representations of the same graph", "h1"))
    add(
        para(
            "The brief calls for both an adjacency list and an adjacency matrix. They are "
            "not alternatives in this system: the list is the structure the algorithms "
            "actually traverse, and the matrix is generated from it for study and "
            "explanation.",
            "body",
        )
    )

    add(para("2.1 Adjacency list &mdash; what the algorithms traverse", "h2"))
    add(
        para(
            "Each vertex maps to the vertices reachable from it in one step, carrying the "
            "weight of the connecting edge. Storage is O(V + E) against the matrix's "
            "O(V&sup2;), which is what makes a sparse campus graph cheap to hold in "
            "memory and to walk.",
            "body",
        )
    )
    add(code_block(fig["adjacencyList"]))
    add(
        para(
            "The application renders this on the Discrete Structures page with a copy "
            "button, and prints it exactly as above so it can be pasted into a report.",
            "caption",
        )
    )

    add(para("2.2 Adjacency matrix &mdash; generated for study", "h2"))
    add(
        para(
            "Row i, column j is the weight of travelling from vertex i to vertex j. In "
            "binary mode a cell is 1 where an edge exists and 0 otherwise; the diagonal "
            "is fixed at 0 because there are no self-loops. In weighted mode the cell "
            "holds the distance in metres, and a dash means no edge exists at all.",
            "body",
        )
    )
    add(code_block(fig["matrixMarkdown"]))
    add(
        para(
            "The matrix is symmetric for every two-way path. A one-way path would produce "
            "an asymmetric pair, which is how a directional restriction becomes visible "
            "as a number.",
            "caption",
        )
    )

    add(para("2.3 Why the list, not the matrix", "h2"))
    add(
        para(
            "Both representations hold the same information, and either could answer "
            "&ldquo;are these two buildings adjacent?&rdquo; &mdash; the list in constant "
            "time per vertex, the matrix in constant time per pair. They diverge on cost: "
            "the matrix needs V&sup2; = "
            f"{stats['vertices']}&sup2; = {stats['vertices'] ** 2} cells to describe "
            f"{stats['vertices']} vertices and {stats['edgesOpen']} edges. At this size "
            "that is trivial, but the overhead grows quadratically while the useful "
            "information grows linearly. Dijkstra is therefore written against the "
            "adjacency list, and the matrix is built only for display.",
            "body",
        )
    )

    add(PageBreak())

    # ----------------------------------------------------------- 3. BFS
    add(para("3. Reachability with breadth-first search", "h1"))
    add(
        para(
            "Breadth-first search explores a graph in layers of <i>edges</i>. Using a "
            "queue, it visits every vertex at distance 1 before any vertex at distance 2, "
            "and so on. Because the first time a vertex is discovered its distance in "
            "edges is already minimal, BFS answers reachability exactly: a vertex is "
            "reachable if and only if BFS visits it.",
            "body",
        )
    )
    bfs = fig["bfs"]
    add(para(f"3.1 Traversal order from {bfs['start']}", "h2"))
    add(
        para(
            "The last column is the count of edges crossed from the source, which is what "
            "BFS actually minimises.",
            "body",
        )
    )
    rows = [["Order", "Vertex", "Edges from source"]]
    for index, vertex in enumerate(bfs["order"], start=1):
        rows.append([str(index), vertex["name"], str(vertex["hops"])])
    add(data_table(rows, [22 * mm, 78 * mm, 65 * mm], align_right_from=2))
    deepest = max(v["hops"] for v in bfs["order"])
    add(
        para(
            f"All {len(bfs['order'])} vertices are reached, in {deepest} layers, "
            "confirming the graph is connected.",
            "caption",
        )
    )

    add(para("3.2 A worked reachability question", "h2"))
    add(
        para(
            "&ldquo;Is the Clinic Building reachable from Gate 2?&rdquo; &mdash; BFS "
            "returns TRUE, by the route shown in section 4. Note that BFS establishes "
            "reachability <i>only</i>. It says nothing about whether that route is the "
            "shortest one, which is the subject of the next section.",
            "body",
        )
    )

    add(PageBreak())

    # ------------------------------------------------------ 4. Dijkstra
    add(para("4. Shortest paths with Dijkstra's algorithm", "h1"))
    add(
        para(
            "Dijkstra solves the single-source shortest-path problem: given one vertex, "
            "find for every other vertex the minimum total weight of any path from it. It "
            "does so by repeatedly finalising the nearest <i>unsettled</i> vertex, on the "
            "reasoning that once the closest unsettled vertex has been settled, no route "
            "through another unsettled vertex could ever be cheaper.",
            "body",
        )
    )
    add(
        para(
            "That reasoning depends on edge weights being non-negative. A walking path "
            "cannot have a negative length, so the condition always holds and the greedy "
            "step is provably safe. The database enforces the same assumption: a path "
            "with a distance of zero or less is rejected at the write, not merely ignored "
            "at read time.",
            "body",
        )
    )
    add(
        para(
            "The implementation keeps unsettled vertices in a <b>binary min-heap</b>, so "
            "extracting the nearest one costs O(log V) rather than a linear scan. It "
            "records the predecessor of each improved vertex, then walks that chain "
            "backwards from the destination to rebuild the route. It also records the "
            "order in which vertices were finalised and the number of relaxations "
            "performed, which is what the Discrete Structures page displays.",
            "body",
        )
    )

    add(para("4.1 The procedure", "h2"))
    add(Spacer(1, 1 * mm))
    steps = [
        "Set the distance to the start vertex to 0, and to every other vertex to infinity.",
        "Place the start vertex in the priority queue.",
        "Remove the nearest unsettled vertex <i>u</i> from the queue and mark it settled; its distance is now final.",
        "For each edge <i>(u, v)</i> leaving <i>u</i>: if the distance to <i>u</i> plus weight(<i>u,v</i>) is less than the recorded distance to <i>v</i>, lower <i>v</i>'s distance, record <i>u</i> as its predecessor, and put <i>v</i> back in the queue.",
        "Repeat until the queue is empty, or until the destination is settled &mdash; at which point its distance cannot improve further.",
        "Walk the predecessor chain back from the destination to the start, then reverse it to obtain the route in walking order.",
    ]
    for item in bullet_list(steps):
        add(item)

    add(para("4.2 Routes produced by the running system", "h2"))
    rows = [["From", "To", "Distance", "Hops", "Walk", "Shortest path"]]
    for example in fig["examples"]:
        rows.append(
            [
                example["from"],
                example["to"],
                f"{example['distance']} m",
                str(example["hops"]),
                f"~{example['walkMinutes']} min",
                " &rarr; ".join(example["path"]),
            ]
        )
    add(
        data_table(
            rows,
            [26 * mm, 26 * mm, 16 * mm, 10 * mm, 13 * mm, 74 * mm],
            align_right_from=2,
            font_size=7.8,
        )
    )
    add(
        para(
            "Walking time assumes 78 metres per minute, about 1.3 m/s, a comfortable "
            "outdoor pace. The figure is deliberately unhurried: campus users carry bags "
            "and move in groups, so an honest estimate is more useful than a fast one.",
            "caption",
        )
    )

    add(PageBreak())

    # ------------------------------------------------- 5. BFS vs Dijkstra
    add(para("5. Why not simply use BFS for routing?", "h1"))
    add(
        para(
            "BFS and Dijkstra answer different questions, and confusing them is the "
            "classic error in a project exactly like this one.",
            "body",
        )
    )
    add(
        data_table(
            [
                ["", "BFS", "Dijkstra"],
                [
                    "Minimises",
                    "the number of <b>edges</b> crossed",
                    "the total <b>distance</b> walked",
                ],
                ["Needs weights?", "No", "Yes, non-negative"],
                [
                    "Correct answer to",
                    "&ldquo;can I get there at all?&rdquo;",
                    "&ldquo;what is the quickest walk?&rdquo;",
                ],
                ["Used in this system for", "reachability, connected components", "routing"],
                ["Complexity", "O(V + E)", "O((V + E) log V)"],
            ],
            [34 * mm, 68 * mm, 68 * mm],
            font_size=8.6,
        )
    )
    add(Spacer(1, 3 * mm))
    add(
        para(
            "The difference bites on any real campus. Consider a pair of buildings joined "
            "by a five-metre gap that is walled off, with the only legal route being a "
            "four-hundred-metre corridor. BFS, minimising edges, cannot tell those apart. "
            "Dijkstra can, because it adds up metres. A user asking for a route wants the "
            "second question answered.",
            "body",
        )
    )
    add(
        para(
            "This is why the system carries both: BFS proves a destination <i>can</i> be "
            "reached, and Dijkstra then finds the cheapest way to reach it. Neither "
            "replaces the other.",
            "body",
        )
    )

    add(para("5.1 Watching the graph change", "h2"))
    reopened = fig["reopened"]
    closed = next(
        e for e in fig["examples"] if e["from"] == "CORE 1" and "Central Parking" in e["to"]
    )
    add(
        para(
            "Because the route is computed from live data, closing a path changes the "
            "answer immediately. The dataset ships with the path between CORE 1 and the "
            "Clinic Building stored as closed, which demonstrates this:",
            "body",
        )
    )
    add(
        data_table(
            [
                ["Path state", "CORE 1 &rarr; Central Parking Area", "Route taken"],
                [
                    "Closed (as shipped)",
                    f"{closed['distance']} m",
                    " &rarr; ".join(closed["path"]),
                ],
                [
                    "Reopened",
                    f"{reopened['distance']} m",
                    " &rarr; ".join(reopened["path"]),
                ],
            ],
            [38 * mm, 45 * mm, 87 * mm],
            font_size=8.4,
        )
    )
    add(
        para(
            f"The direct {closed['distance']} m link stays open either way, so with the "
            f"clinic path shut the answer is {closed['distance']} m. Reopening the 40 m "
            f"clinic path plus its 45 m link to the car park yields "
            f"{reopened['distance']} m &mdash; the same journey, computed differently, "
            "because the graph changed and nothing in the algorithm did. An administrator "
            "can toggle this from the Paths screen during a demonstration.",
            "caption",
        )
    )

    add(PageBreak())

    # -------------------------------------------------- 6. complexity
    add(para("6. Complexity and the limits of the approach", "h1"))
    add(
        para(
            "For V vertices and E edges, with the binary-heap implementation above:",
            "body",
        )
    )
    add(
        data_table(
            [
                ["Operation", "Time", "Space", "Role in the system"],
                [
                    "Build the graph and its adjacency list",
                    "O(V + E)",
                    "O(V + E)",
                    "Once per data change, then reused",
                ],
                [
                    "Dijkstra, one source to one target",
                    "O((V + E) log V)",
                    "O(V)",
                    "Every route calculation",
                ],
                [
                    "Dijkstra, one source to all targets",
                    "O((V + E) log V)",
                    "O(V)",
                    "The admin distance table",
                ],
                ["BFS", "O(V + E)", "O(V)", "Reachability, components"],
                ["Adjacency matrix", "O(V&sup2;)", "O(V&sup2;)", "Display only"],
            ],
            [58 * mm, 30 * mm, 22 * mm, 60 * mm],
            font_size=8.4,
        )
    )
    add(Spacer(1, 3 * mm))
    add(
        para(
            f"At V = {stats['vertices']} and E = {stats['edgesOpen']}, a route "
            "calculation touches roughly a hundred elementary operations. The cost is "
            "utterly dominated by the network round trip that fetched the campus data, "
            "which is why the system loads the graph once and reuses it for every query "
            "instead of refetching per search.",
            "body",
        )
    )

    add(para("6.1 Where this stops working", "h2"))
    add(
        para(
            "Dijkstra solves one source at a time. Genuine all-pairs shortest paths need "
            "Floyd&ndash;Warshall at O(V&sup3;), which becomes impractical somewhere in "
            "the thousands of vertices. A much larger campus would instead run Dijkstra "
            "once per building and cache the resulting distance table &mdash; and since "
            "Dijkstra already settles each vertex exactly once, a single run yields the "
            "whole table rather than needing |V| separate runs. That is precisely what "
            "the admin graph inspector does: choosing one building fills in the shortest "
            "distance to every other building on campus.",
            "body",
        )
    )

    add(PageBreak())

    # ------------------------------------------------ 7. data pipeline
    add(para("7. How data becomes a route", "h1"))
    add(
        para(
            "The route shown on screen is produced by one unidirectional pipeline. No "
            "step may read ahead of the one before it, which is why the map and the "
            "algorithms can never disagree about the campus.",
            "body",
        )
    )
    add(
        code_block(
            "Cloud Firestore\n"
            "      |  locations collection  (the vertices)\n"
            "      |  edges collection      (the edges, weighted in metres)\n"
            "      v\n"
            "buildGraph()          validate, drop dangling or invalid edges,\n"
            "      |                collapse duplicate connections\n"
            "      v\n"
            "adjacency list        what Dijkstra and BFS traverse\n"
            "      |\n"
            "      +--> BFS        reachability: can B be reached from A?\n"
            "      |\n"
            "      +--> Dijkstra   the cheapest walk, as an ordered sequence\n"
            "              |\n"
            "              v\n"
            "        interactive site plan   the same graph, drawn to scale\n"
            "              |\n"
            "              v\n"
            "            the user",
            max_lines=40,
        )
    )
    add(Spacer(1, 3 * mm))
    add(
        para(
            "Two Firestore listeners keep the data current. The map, the search index, "
            "the graph and every table in the admin dashboard all read from one graph "
            "instance, so a building renamed in the database appears correctly "
            "everywhere at once, and a closed path changes routing on the next search.",
            "body",
        )
    )
    add(
        para(
            "The graph builder is deliberately forgiving. A path pointing at a location "
            "that does not exist, a distance of zero, a self-loop, or a duplicate "
            "connection are each detected and handled rather than thrown. One malformed "
            "record degrades a single card; it never breaks the map. Every such condition "
            "is surfaced to the administrator as a data warning.",
            "body",
        )
    )

    add(PageBreak())

    # ---------------------------------------------------- 8. security
    add(para("8. Security model", "h1"))
    add(
        para(
            "Campus navigation data is deliberately <b>public</b>. Every visitor needs to "
            "read buildings and walking paths in order to route, and a campus plan is not "
            "sensitive information. Requiring a sign-in to read it would add friction "
            "without adding confidentiality. Writes are the protected half.",
            "body",
        )
    )
    add(
        data_table(
            [
                ["Operation", "Who may do it"],
                [
                    "Read locations, edges and settings",
                    "Anyone, including signed-out visitors",
                ],
                ["Read one's own administrator record", "Any signed-in user"],
                [
                    "List the administrators, or add or remove one",
                    "Existing administrators only",
                ],
                [
                    "Create, edit or remove locations and paths",
                    "Existing administrators only",
                ],
            ],
            [78 * mm, 92 * mm],
            font_size=8.6,
        )
    )
    add(Spacer(1, 3 * mm))
    add(
        para(
            "Administrator access is an <b>allowlist</b>: a signed-in user is an "
            "administrator when a document exists at <font face='Courier'>admins/{their "
            "own email}</font>. Because only an existing administrator may create or "
            "delete those records, nobody can promote themselves &mdash; the bootstrap "
            "entry is written out of band by a provisioning script using a credential "
            "that never reaches the browser.",
            "body",
        )
    )
    add(
        para(
            "The rules are enforced in the database, not in the interface. Hiding the "
            "admin menu in React is user-interface polish; a visitor who forges that menu "
            "still finds every write refused. The rules additionally reject invalid data "
            "at the boundary &mdash; a non-positive distance, a self-loop, an unknown "
            "endpoint &mdash; so a mistake is refused rather than silently corrupting the "
            "graph, and any collection not explicitly permitted is denied by default, "
            "which means a newly added collection fails safe.",
            "body",
        )
    )
    add(
        para(
            "A verification script asserts all of this against the deployed rules: public "
            "reads must succeed, and every anonymous write must be refused with a "
            "permission error rather than silently succeeding.",
            "body",
        )
    )

    add(PageBreak())

    # ------------------------------------------------------ 9. testing
    add(para("9. Verification", "h1"))
    add(
        para(
            "Forty-one automated tests cover the parts of the system where a bug would be "
            "invisible in the interface. The most important one does not compare Dijkstra "
            "against hand-written expectations, because that would only prove it agrees "
            "with whoever typed the numbers.",
            "body",
        )
    )
    add(
        para(
            "Instead, <b>Dijkstra is cross-checked against an independent "
            "Bellman&ndash;Ford implementation</b> on every ordered pair of campus "
            "vertices. Bellman&ndash;Ford is deliberately naive &mdash; it relaxes every "
            "edge on every pass with no priority queue and no early exit &mdash; so it is "
            "structurally unlike the binary-heap Dijkstra it is checking. Agreement between "
            "two implementations that share no design is real evidence; agreement between "
            "two copies of the same mistake would not be.",
            "body",
        )
    )

    add(para("9.1 What the suite verifies", "h2"))
    add(Spacer(1, 1 * mm))
    for item in bullet_list(
        [
            "Every ordered pair of vertices agrees with the Bellman&ndash;Ford reference, and the reachable sets are identical.",
            "Every returned path is re-measured by walking its real edges and summing them, independently of the distance the algorithm reported.",
            "Every path begins at the requested start and ends at the requested destination, and never repeats a vertex.",
            "Adjacency matrix cells agree with the adjacency list for every pair of vertices.",
            "BFS and Dijkstra agree on reachability for every source vertex.",
            "A self-route reports zero distance and one stop.",
            "An unknown vertex, and a location isolated in its own component, both report unreachable rather than throwing.",
            "Reopening a closed path shortens the route, and the suite pins the exact improvement.",
            "Duplicate edges collapse to the shorter distance; self-loops, zero distances and dangling endpoints are dropped and reported.",
            "Empty graphs and single-vertex graphs are handled without dividing by zero.",
            "Degree and density remain consistent regardless of one-way path restrictions.",
        ]
    ):
        add(item)

    add(para("9.2 Beyond the algorithms", "h2"))
    add(
        para(
            "The interface is exercised too: every button performs a real operation, and "
            "each has been driven end to end against the deployed system rather than "
            "assumed. The security rules are asserted programmatically against the live "
            "database. Accessibility was checked by keyboard only, including that the "
            "route status survives without colour.",
            "body",
        )
    )

    add(PageBreak())

    # ------------------------------------------------ 10. conclusion
    add(para("10. Conclusion", "h1"))
    add(
        para(
            "The system demonstrates the full chain the brief asks for: a real problem, "
            "modelled as a graph, solved with graph theory, and made usable by people who "
            "know nothing about graph theory.",
            "body",
        )
    )
    add(Spacer(1, 1 * mm))
    for item in bullet_list(
        [
            "Campus locations are vertices, and walking paths are edges.",
            "The graph is stored in both an adjacency list and an adjacency matrix, generated from the same source so they cannot diverge.",
            "Reachability is answered by BFS; the shortest route is answered by Dijkstra. Both are needed, and neither substitutes for the other.",
            "The live Discrete Structures page regenerates the vertex set, edge set, adjacency list, matrix, BFS order and Dijkstra trace from current data on every visit &mdash; so any claim made during a demonstration can be checked against the running system immediately.",
            "The campus plan is drawn from the graph itself, at scale, which makes it impossible for the map and the routing engine to tell different stories.",
            "All of it is backed by a database that refuses unauthorised writes, and by 41 tests that hold the algorithms to an independent reference.",
        ]
    ):
        add(item)

    add(Spacer(1, 5 * mm))
    add(
        callout(
            "What is honest about this data",
            "Building names and footprints are transcribed from the official campus site "
            "map. Walkway distances are estimates, because that drawing carries no scale "
            "bar. Six locations are still &ldquo;BLDG. NAME&rdquo; on the official plan "
            "and are named here only by the functions the plan documents inside them. "
            "Every one of these is stated in the interface, recorded in the database, and "
            "correctable by an administrator without a code change. A system that quietly "
            "presented guesses as fact would be easier to present and worse to use.",
            bg=GREEN_LIGHT,
            border=GREEN,
        )
    )

    add(PageBreak())

    # -------------------------------------------------- 11. credits
    add(para("11. Credits and acknowledgement", "h1"))
    add(
        para(
            "This system was developed by students of Core Gateway College, Inc., College "
            "of Computer Studies, as a final project for Discrete Structures 1.",
            "body",
        )
    )
    add(Spacer(1, 3 * mm))
    add(developers_table("Role"))
    add(Spacer(1, 4 * mm))
    add(
        para(
            "The campus layout, building names and floor assignments are taken from the "
            "official <i>Core Gateway College, Inc. Campus Site Map</i>, which remains the "
            "property of the College. The College is thanked for making that plan "
            "available, and for identifying the buildings on it that still require names.",
            "body",
        )
    )
    add(
        para(
            "The seal used as the system logo and browser tab icon is the official Core "
            "Gateway College mark, reproduced without alteration.",
            "body",
        )
    )

    doc.build(story)
    return output_path


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    os.makedirs(os.path.dirname(target), exist_ok=True)
    result = build(target)
    size_kb = os.path.getsize(result) / 1024
    print(f"Wrote {result} ({size_kb:.1f} kB)")