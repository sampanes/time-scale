# Roadmap

## Tracked Follow-ups

- Performance pass before larger data expansion: pan and zoom should schedule DOM work through `requestAnimationFrame`, cache stable segment DOM, and regenerate ticks/view-model data only when the underlying selection or zoom scale changes enough to require it.
- Data trust pass: add source URLs, short notes, and alternate names to timeline items so the persistent detail panel can explain where dates came from.
- Product decision: keep the app vertical true-scale by default. If a compressed mode returns, make it an explicit labeled mode rather than leaving horizontal/log helpers in the main code path.
