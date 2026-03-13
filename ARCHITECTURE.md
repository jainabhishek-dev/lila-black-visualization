# LILA BLACK: Visualization Tool Architecture

## Tech Stack & Rationale
We required a robust, scalable system that could be built rapidly while handling tens of thousands of coordinate points per match cleanly.

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **React + Vite** | React provides an excellent component ecosystem to rapidly iterate on UI (Filters, Timeline, Stats). Vite offers instant Hot Module Replacement (HMR) for incredibly fast development cycles. |
| **Renderer** | **HTML5 Canvas** | Rendering thousands of path lines and gradient nodes in SVG/DOM causes massive lag. The HTML5 Canvas API allows for high-performance immediate-mode 2D rendering of player telemetry and intense heatmaps. |
| **Backend / DB** | **Supabase** | Managed PostgreSQL provides phenomenal relational structuring for `matches` and `events`. Supabase's integrated PostgREST API removed the need to spin up and route a custom Node/Python backend, saving immense time. |
| **ETL Pipeline** | **Python (Pandas/PyArrow)** | PyArrow excels at bulk-reading Parquet files. Python easily allowed for mathematical transforms on 1,200+ raw data files before pushing them symmetrically into Supabase via batch chunks. |

## Data Flow
1. **Raw to DB:** The Python ETL script (`etl.py`) iterates over the `.nakama-0` parquet files. It parses out standard UUIDs (Humans) vs numeric IDs (Bots), translates coordinates, and upserts batches of telemetry into the Supabase Postgres Database. A secondary pass generates a `matches` aggregation table.
2. **Backend to Frontend:** Upon loading, the React app queries Supabase directly (via `supabase-js`) to retrieve unique maps, dates, and match structures. 
3. **User Input to Canvas:** When a Level Designer selects a Match, millions of event records are bypassed, and only the 1,000-5,000 events specific to that `match_id` are downloaded. These are passed to the `MinimapCanvas` component and the `PlaybackTimeline`, rendering live states.

## Coordinate Mapping Approach
The raw game data outputs telemetry in World Coordinates `(x, y, z)`. However, the visual minimap images provided are 2D squares with an implicit `1024x1024` pixel dimension.

To solve this, we projected the 3D space onto the 2D plane by discarding the vertical `y` (elevation) axis and using the map-specific `scale`, `origin_x`, and `origin_z` variables.

1. Normalize the point between `0.0` and `1.0`:
   * `u = (x - origin_x) / scale`
   * `v = (z - origin_z) / scale`
2. Multiply by the map dimensions and invert the Y-axis (since 2D renderers treat Y=0 as the top, but game engines calculate from the bottom):
   * `pixel_x = int(u * 1024)`
   * `pixel_y = int((1 - v) * 1024)`
3. These transformations occur asynchronously inside the ETL pipeline, so the database stores the pre-calculated `px` and `py` values, minimizing frontend CPU usage.

## Assumptions & Data Ambiguities
*   **Timestamps:** Timestamps in parquet datasets are highly granular (`ns`). This was cast back to `ms` integrally to function uniformly natively within JavaScript `Date` and `SetTimeout` behaviors.
*   **Bot Detection:** There was no explicit explicit "is_bot" column. I assumed that Human user IDs adhered to standard 36-character hyphenated UUID definitions, while Bot IDs were strictly sequential numeric blocks.
*   **Play Speed:** Test dataset events happen in milliseconds (synthetic data). Thus, the timeline scales up natively to display the action accurately.

## Major Trade-offs
| Trade-off | Decision | Justification |
| :--- | :--- | :--- |
| **Full backend vs. Direct DB calls** | Evaluated building an Express.js API vs querying Supabase directly from the client. Decided to **query directly**. | Given the timeline (5 days), creating a proprietary API layer added unneeded boilerplate. Supabase handles Row Level Security safely in production. |
| **Global Heatmaps vs Match Heatmaps** | Allowed heatmaps to generate globally or mapped strictly to match data. | Due to dataset size, Heatmaps currently derive from the singular active Match for high-fidelity accuracy rather than blurring millions of events globally. |
