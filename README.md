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

## 사용법

명령어를 외울 필요 없어요. 작업하던 폴더에서 Claude에게 말하면 돼요.

| 하고 싶은 것 | 이렇게 말하기 |
|---|---|
| 작업 기록 | "기록해줘" — 또는 Claude가 결과가 나올 때 "💾 여기까지 기록해둘까요?"라고 먼저 물어요 |
| 미팅 후 피드백 | "미팅 끝났어, 피드백 정리해줘" + 노션 메모나 녹음 텍스트 |
| 미팅 자료 | "이번 주 미팅 자료 만들어줘" |
| 설정 바꾸기 | "내 llm-wiki도 참고해줘", "이 폴더도 KAMP에 포함해줘", "허브 위치 바꿔줘" |

처음 쓰면 허브(`~/meeting-hub`)가 자동으로 만들어지고, 이 폴더를 어떤 이름으로 등록할지 한 번만 물어요.
슬래시 명령(`/meeting-prep:log`, `/meeting-prep:feedback`, `/meeting-prep:meeting`)은 지름길로 쓸 수 있어요.

### 기록 제안 간격

기록이 90분 넘게 없으면 Claude가 적당한 순간에 제안해요. 간격은 `~/.meeting-prep/config.json`의 `nudgeMinutes`로 바꿀 수 있어요.

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
node renderer/render.js <deck.md> --formats pptx,pdf
```

`deck.md` 형식은 `skills/meeting/deck-format.md`를 보세요.

## 개발

```
npm install
npm test
npm run reinstall   # 코드를 고친 뒤 설치본 갱신
```
