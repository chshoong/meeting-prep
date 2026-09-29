#!/usr/bin/env node
// 어떤 경우에도 종료 코드 0. 종료 코드 2는 사용자 입력을 지우므로 절대 쓰지 않는다.
async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const { promptContext } = await import('./context.js');
  const text = promptContext(input, process.env);
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }));
}
main().catch(() => {}).finally(() => { process.exitCode = 0; });
