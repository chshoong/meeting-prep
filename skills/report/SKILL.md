---
name: report
description: 트랙의 대화형 웹 보고서(인터넷 없이 열리는 HTML 파일 하나)를 만들거나 갱신한다. 조건 비교, 필터, 정렬·검색 표, 요약 카드, 접는 설명이 들어간다. "보고서 업데이트해줘", "웹 보고서 만들어줘", "결과 페이지 만들어줘"라고 할 때, 또는 meeting 스킬이 보고서 갱신을 제안해 사용자가 동의했을 때 사용한다.
argument-hint: "[보고서에 넣을 결과나 강조할 내용]"
---

# 웹 보고서 만들기

허브 CLI는 `node "${CLAUDE_PLUGIN_ROOT}/hub/cli.js"`, 보고서 렌더러는 `node "${CLAUDE_PLUGIN_ROOT}/renderer/report.js"`이다. `report.md` 작성 규칙은 `${CLAUDE_PLUGIN_ROOT}/skills/report/report-format.md`에 있다. 쓰기 전에 반드시 읽는다.

## 절대 규칙

- **숫자와 결과는 데이터 파일·로그에 있는 것만 쓴다.** 근거가 없으면 `⚠ 확인 필요`로 쓰고 마지막에 알린다.
- 데이터를 변환할 때 **값은 바꾸지 않는다.** 모양만 바꾼다.

## 1. 준비

Skill 도구로 `meeting-prep:setup`을 불러 "1. 준비"를 먼저 한다. `status --track "<트랙>"`으로 트랙 폴더(`dir`), `open`, `previous`를 얻는다. 보고서 폴더는 `<트랙 dir>/report/`다.

## 2. 뼈대

`report/report.md`가 없으면 만든다.
- 연구 트랙: 탭 `goal`(목표), `data`(데이터), `method`(방법), `results`(결과), `discussion`(해석)
- 프로젝트 트랙: 탭 `overview`(개요), `progress`(진행), `results`(결과), `issues`(이슈)
- 머리 블록의 `title`은 트랙 주제, `kicker`는 "<트랙> · <연구|프로젝트> 보고서", `pills`는 데이터 기간·반복 수 같은 핵심 설정.

## 3. 새 결과 찾기와 데이터 준비

1. 이번 사이클 `log.md`의 `결과`, `산출물` 줄과 이 채팅에서 새 결과를 찾는다.
2. 조건 비교·필터가 필요한 결과는 **정돈된 긴 표**(한 줄 = 실행 결과 하나, 조건 열 + 지표 열)로 만든다.
   - 원본이 이미 그 모양이면 `copy-asset --deck-dir "<보고서 폴더>" --src "<원본>"`으로 `assets/`에 복사한다.
   - 아니면 `report/scripts/<이름>.py` 또는 `.mjs`에 변환 스크립트를 쓰고 실행해서 `assets/<이름>.csv`를 만든다. 원본과 행 수·합계(또는 지표 평균)를 대조한다.
3. 대조 결과를 해당 섹션의 `details` 부품("데이터 출처": 원본 경로, 스크립트 경로, 행 수, 대조 결과)으로 남긴다.
4. `datasets`에 등록한다(`dims`, `metrics`의 `label`, `decimals`, `better`).

## 4. 섹션 쓰기

- 알맞은 탭에 섹션을 추가하거나 고친다. 이번에 만들거나 크게 고친 섹션의 `cycle`은 오늘 날짜다.
- 결과가 바뀌어 예전 섹션이 더 이상 맞지 않으면 지우지 말고 `archived: true`.
- 부품 고르기:
  - 여러 조건의 결과 → `compare`(+ 자주 보는 조합은 `presets`), 조건별로 좁혀 볼 것 → `filter` + `from` 차트·표
  - 핵심 수치 → `stats`, 과정 → `steps`, 방법 소개 → `cards`, 긴 설명 → `details`, 주의점 → `callout`
  - 부품으로 안 되는 도식·특수 그래프 → `custom`
- 섹션 제목은 결론에 가깝게("선정 모델이 6개 제품 모두에서 앞섰다").

## 5. 만들고 확인하기

```
node "${CLAUDE_PLUGIN_ROOT}/renderer/report.js" "<보고서 폴더>/report.md" --preview
```

- `ok`가 false면 `errors`의 `block`·`line`을 보고 고쳐 다시 실행한다(3번까지).
- `outputs.preview`의 탭 이미지를 Read 도구로 모두 본다. 깨짐, 빈 부품, 읽기 어려운 차트가 있으면 고치고 다시 만든다(최대 2회).
- 경고는 모두 전한다. 크기 경고가 있으면 안 쓰는 열을 빼자고 제안한다.
- 미리보기가 막히면(샌드박스) "샌드박스 밖에서 다시 실행할까요?"라고 묻는다.

## 6. 미팅 강조판

미팅 준비 중이면 누적판을 만든 뒤 강조판도 만든다.

```
node "${CLAUDE_PLUGIN_ROOT}/renderer/report.js" "<보고서 폴더>/report.md" --highlight <미팅 날짜> --feedback "<previous.dir>/feedback.md" --log "<open.dir>/log.md" --out "<open.dir>/report/report-<미팅 날짜>.html" --preview
```

(`previous`가 없으면 `--feedback`을 뺀다.)

열린 사이클(`open`)이 없으면 강조판은 만들지 않고 누적판만 알린다.

## 7. 알리기

- 누적판과 강조판 경로
- "HTML 파일 하나라서 메일로 보내도 인터넷 없이 열려요. 미팅 때는 브라우저로 열어 화면 공유하면 돼요."
- `⚠ 확인 필요` 목록
