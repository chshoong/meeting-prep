#!/usr/bin/env node
// 어떤 경우에도 종료 코드 0. 모듈을 못 불러와도(예: node_modules 없음) 조용히 끝난다.
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const { sessionStartContext } = await import('./context.js');
  const text = sessionStartContext(input, process.env);
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}
main().catch(() => {}).finally(() => { process.exitCode = 0; });
