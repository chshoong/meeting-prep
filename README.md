# meeting-prep

대학원생을 위한 교수님 미팅 자료 생성기 (Claude Code 플러그인).
Claude와 작업하면서 로그를 남기고, 미팅이 끝나면 피드백을 기록하면, 다음 미팅 자료(PPTX, PDF, HTML)를 그 기록을 근거로 만들어줍니다.

## 필요한 것

- Node.js 20 이상
- PDF를 만들려면 Chrome 또는 Edge (윈도우에는 Edge가 기본으로 있음)

## 설치

```
claude plugin marketplace add <이 폴더 경로>
claude plugin install meeting-prep@meeting-prep-local
```

한 번만 써보려면: `claude --plugin-dir <이 폴더 경로>`

## 사용 흐름

```
/meeting-prep:meeting-init     처음 한 번: 허브 만들기, 논문 정리 폴더 등록(선택)
/meeting-prep:track-add        논문·프로젝트 트랙 추가
/meeting-prep:log              작업하다가 수시로: 이번 채팅에서 한 일 기록
/meeting-prep:meeting          미팅 전: 자료 만들기 (목차를 먼저 확인받음)
/meeting-prep:feedback         미팅 후: 교수님 피드백 정리 → 다음 사이클 시작
/meeting-prep:knowledge-add    나중에 논문 정리 폴더 추가
```

## 허브 구조

```
~/meeting-hub/
  hub.md                  지식 소스 목록
  library/                논문 노트 (지식 소스가 없을 때 자동으로 쌓임)
  tracks/research|project/<트랙>/
    track.md              작업 폴더 목록
    cycles/<미팅 날짜>/    feedback.md, log.md, deck/
    cycles/next/          진행 중인 사이클
```

모든 파일은 마크다운이라 직접 열어서 고쳐도 됩니다.

## 렌더러만 쓰기

```
node renderer/render.js <deck.md> --formats pptx,html,pdf
```

`deck.md` 형식은 `skills/meeting/deck-format.md`를 보세요.

## 개발

```
npm install
npm test
```
