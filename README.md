# meeting-prep

대학원생을 위한 교수님 미팅 자료 생성기 (Claude Code 플러그인).
Claude와 작업하면서 로그를 남기고, 미팅이 끝나면 피드백을 기록하면, 다음 미팅 자료(PPTX, PDF)를 그 기록을 근거로 만들어줍니다.

## 필요한 것

- Node.js 20 이상 (`node -v`로 확인. 없으면 https://nodejs.org 에서 LTS 설치, 윈도우는 `winget install OpenJS.NodeJS.LTS`)
- 터미널의 `claude` 명령 (`claude --version`으로 확인. 데스크톱 앱만 있으면 `npm install -g @anthropic-ai/claude-code` 후 `claude`로 한 번 로그인)
- PDF를 만들려면 Chrome 또는 Edge (윈도우에는 Edge가 기본으로 있음)

## 설치

**가장 쉬운 방법**: Claude Code에서 새 채팅을 열고 아래 메시지를 그대로 보내세요. Node.js 설치까지 Claude가 해요.

```
meeting-prep 플러그인(https://github.com/chshoong/meeting-prep)을 설치해줘. 순서대로 해줘.
1. node -v로 Node.js 20 이상인지 확인해. 없거나 낮으면 설치해줘(윈도우: winget install OpenJS.NodeJS.LTS, 맥: brew install node). 설치한 뒤에는 PATH를 새로 읽어서 다시 확인해.
2. claude 명령을 찾아. PATH에 없으면 Claude 데스크톱 앱 폴더(윈도우는 %APPDATA%\Claude\claude-code\<버전>\claude.exe) 중 가장 최신 버전을 써. 그래도 없으면 npm install -g @anthropic-ai/claude-code로 설치해.
3. claude plugin marketplace add chshoong/meeting-prep 과 claude plugin install meeting-prep@meeting-prep-local 을 실행해.
4. claude plugin list로 설치됐는지 확인하고, 새 채팅을 열어야 적용된다고 알려줘.
```

**직접 설치**: 터미널에서 두 줄을 실행한 뒤, 작업하던 폴더에서 **새 채팅**을 여세요.

```
claude plugin marketplace add chshoong/meeting-prep
claude plugin install meeting-prep@meeting-prep-local
```

필요한 패키지는 처음 쓸 때("기록해줘" 등) 자동으로 설치돼요.

업데이트:

```
claude plugin marketplace update meeting-prep-local
claude plugin update meeting-prep@meeting-prep-local
```

사용 안내 페이지: https://chshoong.github.io/meeting-prep/

## 사용법

명령어를 외울 필요 없어요. 작업하던 폴더에서 Claude에게 말하면 돼요.

| 하고 싶은 것 | 이렇게 말하기 |
|---|---|
| 작업 기록 | "기록해줘" — 또는 Claude가 결과가 나올 때 "💾 여기까지 기록해둘까요?"라고 먼저 물어요 |
| 미팅 후 피드백 | "미팅 끝났어, 피드백 정리해줘" + 노션 메모나 녹음 텍스트 |
| 미팅 자료 | "이번 주 미팅 자료 만들어줘" |
| 설정 바꾸기 | "내 llm-wiki도 참고해줘", "이 폴더도 KAMP에 포함해줘", "허브 위치 바꿔줘" |
| 웹 보고서 | "보고서 업데이트해줘" — 조건 비교·필터가 되는 HTML 한 파일(인터넷 없이 열림) |

처음 쓰면 허브(`~/meeting-hub`)가 자동으로 만들어지고, 이 폴더를 어떤 이름으로 등록할지 한 번만 물어요.
슬래시 명령(`/meeting-prep:log`, `/meeting-prep:feedback`, `/meeting-prep:meeting`)은 지름길로 쓸 수 있어요.

### 기록 제안 간격

기록이 90분 넘게 없으면 Claude가 적당한 순간에 제안해요. 간격은 `~/.meeting-prep/config.json`의 `nudgeMinutes`로 바꿀 수 있어요.

처음 몇 번은 Claude가 `node ...` 명령 실행 허락을 물을 수 있어요. 매번 묻지 않게 하려면 허락할 때 '항상 허용'을 고르세요.

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
node renderer/render.js <deck.md> --formats pptx,pdf --preview
```

- 슬라이드 레이아웃 10종(표지, 간지, 차트, 수치 카드, 단계 카드, 그림, 표, 피드백 현황, 비교, 글머리표)
- 단순 비교는 PowerPoint 기본 차트로 그려서 PowerPoint에서 바로 고칠 수 있어요.
- `--preview`를 붙이면 `preview/slide-01.png`처럼 슬라이드 이미지를 만들어요.
- PowerPoint에서도 같은 글꼴로 보려면 [Pretendard](https://github.com/orioncactus/pretendard/releases)를 설치하세요.

`deck.md` 형식은 `skills/meeting/deck-format.md`를 보세요.

```
node renderer/report.js <report.md> --preview
node renderer/report.js <report.md> --highlight 2026-10-06 --feedback feedback.md --log log.md --out report-2026-10-06.html
```

`report.md` 형식은 `skills/report/report-format.md`를 보세요.

## 개발

```
npm install
npm test
npm run reinstall   # 코드를 고친 뒤 설치본 갱신
```
