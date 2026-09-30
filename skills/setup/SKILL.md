---
name: setup
description: meeting-prep의 허브·패키지·트랙을 자동으로 준비하고, "이 폴더를 미팅 트랙으로 등록해줘", "새 프로젝트 등록해줘", "내 llm-wiki도 참고해줘", "논문 PDF 폴더 추가해줘", "이 폴더도 KAMP에 포함해줘", "허브 위치 바꿔줘" 같은 설정 요청을 처리한다. log, feedback, meeting 스킬이 시작할 때 먼저 사용한다.
user-invocable: false
---

# meeting-prep 준비와 설정

허브 CLI는 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js"`이다. 출력은 항상 JSON이고, `ok`가 false면 `error`를 그대로 전하고 멈춘다.

## 1. 준비 (다른 스킬이 시작할 때)

1. `ensure --cwd "<현재 작업 폴더>"`를 실행한다.
   - `node`를 찾을 수 없으면: "Node.js가 필요해요. https://nodejs.org 에서 LTS 버전을 설치해주세요."라고 안내하고 멈춘다.
   - `Cannot find package` 또는 `ERR_MODULE_NOT_FOUND`로 실패하면: `npm install --omit=dev --prefix "${CLAUDE_PLUGIN_ROOT}"`를 실행한 뒤 다시 실행한다.
2. `createdHub`가 true면 "미팅 허브를 `<hubPath>`에 만들었어요."라고 한 줄만 알린다. 묻지 않는다.
3. `tracks`를 본다.
   - **1개**: 그 트랙을 쓴다.
   - **여러 개**: 부른 스킬의 규칙을 따른다.
   - **0개**: 한 번만 묻는다.
     > 이 폴더를 미팅 트랙으로 등록할게요. 이름은 **<폴더 이름>**으로 할까요? 연구(논문)예요, 프로젝트예요?
     - 이름을 바꾸라고 하면 그 이름을 쓴다. 종류를 말하지 않으면 폴더 내용(논문 초안, 실험 코드 → 연구 / 과제·개발 산출물 → 프로젝트)으로 추측하고 추측한 종류를 알린다.
     - `track-add --name "<이름>" --type <research|project> --source "<현재 작업 폴더>"`
     - 사용자가 답하지 않고 다른 요청을 하면, 부른 스킬을 멈추고 그 요청을 처리한다.

## 2. 설정 변경 요청

- **지식 소스 추가** ("내 llm-wiki도 참고해줘", "논문 폴더 추가"):
  - 경로를 모르면 묻는다. 폴더를 훑어 `.md`가 주로 있으면 `wiki`, `.pdf`가 주로 있으면 `pdf`로 정한다.
  - `knowledge-add --type <wiki|pdf> --path "<경로>"`
  - "이 폴더는 읽기만 하고 고치지 않아요."라고 알린다.
- **트랙에 작업 폴더 추가** ("이 폴더도 KAMP에 포함해줘"):
  - `source-add --track "<트랙>" --path "<폴더>"` (폴더를 말하지 않으면 현재 작업 폴더)
- **허브 위치 변경** ("허브 위치 바꿔줘"):
  - 새 위치를 묻고 `hub-move --path "<새 위치>"`. `EXISTS`면 다른 위치를 고르게 한다.
- **새 트랙 추가** ("이 폴더를 미팅 트랙으로 등록해줘", "새 프로젝트 등록해줘"): 먼저 1의 준비(`ensure`)를 한 뒤, 1-3의 0개일 때와 같은 질문으로 `track-add`.

외부 지식 소스 폴더에는 절대 쓰지 않는다.
