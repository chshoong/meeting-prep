---
name: knowledge-add
description: 논문 정리 폴더(마크다운 위키나 논문 PDF 폴더)를 미팅 허브의 지식 소스로 등록한다. "llm-wiki 연결", "논문 폴더 추가"라고 할 때 사용한다.
argument-hint: "[폴더 경로]"
---

# 지식 소스 추가

허브 CLI는 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js"`이다. `ok`가 false면 `error`를 전하고 멈춘다.

1. **경로**: `$ARGUMENTS`가 있으면 쓰고, 없으면 묻는다.
2. **형식**: 폴더를 훑어보고 판단한다. 애매할 때만 묻는다.
   - `.md` 파일이 주로 있으면 `wiki`
   - `.pdf` 파일이 주로 있으면 `pdf`
3. 실행: `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js" knowledge-add --type <wiki|pdf> --path "<경로>"`
4. 등록된 지식 소스 목록을 보여준다. 허브는 이 폴더를 읽기만 하며, 외부 지식 소스가 있으면 앞으로 `/meeting-prep:log`가 `library/`에 새 노트를 쓰지 않는다고 알려준다.
