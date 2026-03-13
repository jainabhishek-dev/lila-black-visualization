# LILA BLACK - Player Journey Visualization Tool

This repository contains a full-stack web-based visualization tool designed for Level Designers to explore player behavior, analyze match flow, and identify gameplay hotspots in **LILA BLACK**.

## Deployed Access
https://lila-black-visualization.vercel.app/

## Features
- **Interactive Minimaps**: View precise player movement and events overlaid onto high-res maps (`AmbroseValley`, `GrandRift`, `Lockdown`).
- **Data Filtering**: Filter and explore 1,000+ matches by Map, Date, and Match ID. 
- **Advanced Match Selector Modals**: Instantly sort and filter matches by the number of Human players, Bots, Total Events, or Match length.
- **Match Playback Timeline**: Scrub through a match chronologically using playback controls (play, pause, multi-speed) to watch strategies unfold.
- **Differentiated Entities**: Human players (smooth blue lines) and Bot players (dashed red lines) are tracked visually on the canvas.
- **Detailed Heatmaps**: Dynamically toggle heatmaps with custom saturated composite blending for:
  - Kill Zones
  - Death Zones
  - Storm Deaths
  - Loot Zones
  - High Traffic / Player Movement
- **Analytics Dashboard (Planned)**: High-level data aggregations using Recharts to present statistics without scrubbing individual matches.
- **AI Level Designer Assistant (Planned)**: A ChatGPT-style interface powered by Gemini API and Supabase MCP, allowing designers to query the underlying PostgreSQL database directly using natural language.

## Technology Stack
*   **Frontend**: React (18), Vite, HTML5 Canvas (for rendering high-volume event data smoothly).
*   **Backend / Database**: Supabase (Managed Postgres) for scalable event querying.
*   **ETL Pipeline**: Python, Pandas, and PyArrow for processing raw parquet telemetry data into the relational database.

## Local Setup & Installation

### 1. Database & ETL (Python)
1. Ensure you have a Supabase project created.
2. Execute the `etl/supabase.sql` schema inside your Supabase project's SQL editor to generate the `events` and `matches` tables.
3. Install Python dependencies:
   ```bash
   pip install pandas pyarrow supabase tqdm
   ```
4. Place the unzipped `player_data` folder inside `player_behavior_visualisation/player_data/`.
5. Set your Service Role key to securely upload raw data:
   ```bash
   export SUPABASE_KEY="your-service-role-key"
   ```
6. Run the ETL pipeline to parse and structure the telemetry data:
   ```bash
   python etl.py
   ```

### 2. Frontend Application (React)
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Create a `.env` file in the `frontend` folder with your Supabase keys:
   ```env
   VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` in your browser.
