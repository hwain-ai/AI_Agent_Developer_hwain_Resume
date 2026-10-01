# 이력서 PDF 자동 갱신과 커밋 검사

`index.html`을 고친 뒤 `npm run resume:pdf`를 실행한다. 생성기는 Chrome의 A4·100%·배경 인쇄 설정으로 4쪽 PDF를 만들고, 원본과 PDF의 SHA-256을 `.resume-build.json`에 저장한다. 폰트·이미지 로딩 실패, 페이지 넘침, 생성 중 원본 변경이 있으면 기존 PDF를 유지하고 실패한다. 해시는 파일 동기화 검사용이며 출판 내용에 대한 보안 서명이 아니다.

## 적용 순서

1. Node.js와 Chrome을 준비하고 `npm install`을 실행한다. 현재 PC에서는 Codex에 이미 포함된 같은 패키지도 사용할 수 있으며 이 경우 경로를 출력한다.
2. `npm run hooks:install`로 이 저장소에만 Git 훅을 연결한다. 기존 전역 훅은 `resume.previousHooksPath`에 보관한 경로로 이어 실행한다.
3. Codex의 `/hooks`에서 `.codex/hooks.json`의 두 훅을 검토하고 신뢰한다. 신뢰하지 않은 훅은 Codex가 실행하지 않는다. Claude 세션도 다시 열어 `.claude/settings.json`을 읽는다.
4. PDF를 갱신하고 HTML·PDF·생성 기록을 함께 커밋한다. `npm run lint` 통과 후 push한다.

에이전트 훅 명령은 현재 Windows 프로젝트의 절대 경로를 사용한다. 저장소를 이동했다면 두 설정의 경로를 새 위치로 바꾸고 Codex에서 다시 검토한다.

## 검사 지점

| 지점 | 동작 |
| --- | --- |
| 두 에이전트의 PreToolUse | `git commit` 직전 PDF 갱신. `git push` 직전 원본 일치 및 커밋 확인 |
| 두 에이전트의 Stop | 이력서 변경이 미커밋이면 완료를 차단하고 커밋 안내 |
| Git pre-commit | 이력서 입력이 스테이징되면 PDF 생성 후 PDF와 생성 기록을 함께 스테이징. 입력에 미스테이징 변경이 섞였으면 차단 |
| Git pre-push | 작업 폴더와 실제 전송할 각 커밋의 PDF·생성 기록 일치 확인. 기존 Git LFS 훅에도 같은 입력 전달 |

Git 훅은 양쪽 도구가 실제 실행하는 Git에도 적용된다. 에이전트의 명령 감지는 일반적인 직접 Git 명령을 대상으로 하며, 별칭과 스크립트 안의 Git은 Git 훅이 검사한다. 에이전트는 생성 파일 외의 사용자 변경을 자동으로 스테이징하거나 커밋하지 않는다.

`npm test`는 오래된 PDF, PDF 임의 변경, 미커밋 변경, 부분 스테이징, Stop/PreToolUse 차단, 실제 전송 커밋 검사를 임시 저장소에서 검증한다.

## 출력 검증과 복구

자동 PDF 검사는 Chrome의 PDF 생성 경로다. 실제 Windows 프린터 Ctrl+P 결과와 동일하다고 단정하지 않는다. 최초 변경과 레이아웃 수정 후에는 저장 PDF를 눈으로 확인한다. 폰트 CDN에 접속하지 못하면 접속을 복구한 후 재실행한다. 출력 교체 도중 중단되면 생성 기록 불일치가 다음 검사에서 잡히며 `npm run resume:pdf`로 복구한다.

기존 훅으로 되돌릴 때는 `git config --get resume.previousHooksPath` 값을 확인하고 그 경로를 `git config --local core.hooksPath`로 복원한다. 에이전트 설정에서는 이 프로젝트의 훅 두 개만 제거한다.

공식 형식: [Codex Hooks](https://learn.chatgpt.com/docs/hooks), [Claude Code Hooks](https://code.claude.com/docs/en/hooks).
