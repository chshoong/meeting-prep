---
name: track-add
description: 미팅 허브에 연구(논문) 트랙이나 프로젝트 트랙을 추가한다. "새 프로젝트 등록", "논문 트랙 추가"라고 할 때 사용한다.
argument-hint: "[트랙 이름]"
---

# 트랙 추가

허브 CLI는 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js"`이다. `ok`가 false면 `error`를 전하고 멈춘다. `NO_HUB`면 `/meeting-prep:meeting-init`을 먼저 하도록 안내한다. 지금 바로 만들지 물어보고, 원하면 meeting-init 절차를 따른다.
명령이 `Cannot find package` 또는 `ERR_MODULE_NOT_FOUND`로 실패하면 `npm install --omit=dev --prefix "${CLAUDE_PLUGIN_ROOT}"`를 실행한 뒤 다시 시도한다.

한 번에 하나씩 묻는다. 이미 알 수 있는 것은 묻지 않는다.

1. **이름**: `$ARGUMENTS`가 있으면 그것을 쓴다. 없으면 묻는다. 예: "논문A", "산학과제 2026"
2. **종류**:
   - `research`: 논문 작성, 연구. 미팅에서 아이디어의 타당성과 실험 결과를 본다.
   - `project`: 과제, 개발 프로젝트. 미팅에서 일정, 진행률, 산출물을 본다.
3. **작업 폴더**: 코드, 실험 결과, 산출물이 있는 폴더들. 여러 개 가능하다.
   - 지금 작업 폴더가 이 트랙과 관련 있어 보이면 그 경로를 먼저 제안한다.
   - 이 경로들은 `/meeting-prep:log`가 트랙을 자동으로 고를 때 쓰인다고 알려준다.
   - 논문 정리 폴더는 여기가 아니라 지식 소스(`/meeting-prep:knowledge-add`)로 등록한다고 안내한다.
4. **한 줄 설명** (선택): 목표나 현재 단계

실행:
```
node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js" track-add --name "<이름>" --type <research|project> --source "<폴더1>" --source "<폴더2>" --description "<설명>"
```

결과의 `dir`에 트랙이 만들어졌고, 첫 사이클(`cycles/next/`)이 열렸다고 알려준다.
