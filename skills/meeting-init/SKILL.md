---
name: meeting-init
description: 미팅 허브를 처음 만들거나 위치를 다시 정한다. meeting-prep을 처음 쓰거나, "허브 만들어줘", "미팅 준비 설정해줘"라고 할 때 사용한다.
argument-hint: "[허브 경로]"
---

# 미팅 허브 만들기

허브 CLI는 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js"`이다. 출력은 항상 JSON이며 `ok`가 false면 `error`를 사용자에게 그대로 전하고 멈춘다.

## 1. 실행 환경 확인

1. `node --version`을 실행한다. 실패하면 "Node.js가 필요합니다. https://nodejs.org 에서 LTS 버전을 설치해주세요."라고 안내하고 멈춘다.
2. `${CLAUDE_PLUGIN_ROOT}/node_modules`가 없으면 실행한다:
   `npm install --omit=dev --prefix "${CLAUDE_PLUGIN_ROOT}"`

## 2. 허브 위치 정하기

- 인자가 있으면 그 경로를 쓴다: `$ARGUMENTS`
- 없으면 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js" status`를 실행한다.
  - 성공하면 이미 허브가 있다. 위치(`hubPath`)를 알려주고 새로 만들지 물어본다. 원하지 않으면 멈춘다.
  - `NO_HUB`면 기본 위치 `~/meeting-hub`(홈 폴더 아래)를 제안하고 확인받는다.
- 실행: `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js" init --path "<경로>"`

## 3. 논문 정리 폴더(지식 소스)

한 번에 하나만 묻는다: "읽은 논문이나 공부한 내용을 정리해둔 폴더가 있나요?"

1. **마크다운 폴더** (llm-wiki, Obsidian, 노션 내보내기 등) → 경로를 받아
   `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js" knowledge-add --type wiki --path "<경로>"`
2. **논문 PDF 폴더** → `--type pdf`로 같은 명령
3. **없음** → "괜찮아요. `/meeting-prep:log`를 할 때 읽은 논문을 허브의 `library/`에 자동으로 정리해둘게요."라고 안내하고 넘어간다.

여러 개면 하나씩 등록한다. 허브는 이 폴더들을 읽기만 하고 고치지 않는다고 알려준다.

## 4. 첫 트랙

"지금 진행 중인 논문이나 프로젝트를 하나 등록할까요?"라고 묻고, 원하면 `track-add` 스킬의 절차를 그대로 따른다.

## 5. 마무리

다음을 짧게 알려준다.
- 허브 위치
- 등록된 지식 소스 (없으면 `library/` 사용)
- 앞으로 쓸 명령: `/meeting-prep:log`(작업 기록), `/meeting-prep:feedback`(미팅 후 피드백), `/meeting-prep:meeting`(미팅 자료 만들기)
