# River Raid Research Notes

Sources:

- Wikipedia, "River Raid": https://en.wikipedia.org/wiki/River_Raid
- AtariAge manual transcription: https://www.atariage.com/manual_html_page.php?SoftwareLabelID=409

Implementation targets:

- Vertical endless river with the player craft held near the lower screen.
- Left/right banking, up/down speed control, and hold-to-fire.
- Energy drains at a constant rate regardless of speed, matching the original fuel rule.
- Recharge stations replace fuel depots: flying over them restores charge, and shooting them awards points.
- Slower flight gives more recharge because the plane overlaps the station longer.
- Terrain banks, enemies, bridges, and running out of charge cost a life.
- Bridges end sections and act as checkpoints once destroyed.
- Difficulty increases through narrower channels, moving enemies, and scarcer recharge stations.

Original score references used:

- Tanker/barge: 30
- Helicopter/drone: 60
- Fuel depot/charger: 80
- Jet: 100
- Bridge/gate: 500

Unverified exact values:

- Original Atari 2600 speed constants, acceleration curves, fuel drain/refill values, hitboxes, and procedural generation tables are not available from the public sources used here. The implementation uses deterministic approximations tuned for mobile readability.
