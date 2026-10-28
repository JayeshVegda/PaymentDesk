process.env.NODE_ENV = 'production';
// Keep V8 from growing an unnecessarily large heap on the 4 GB workstation.
// An explicit user-provided NODE_OPTIONS always wins.
process.env.NODE_OPTIONS ??= '--max-old-space-size=512';
await import('../apps/server/dist/index.js');
