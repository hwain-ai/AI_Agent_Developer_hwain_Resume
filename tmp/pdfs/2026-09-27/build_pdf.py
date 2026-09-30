"""Render the approved text in the supplied PDF's A4 visual style."""
from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path

import pymupdf as fitz
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Paragraph, Spacer


ROOT = Path(__file__).resolve().parents[3]
WORK = Path(__file__).resolve().parent
SOURCE = ROOT / 'output/pdf/AI_Engineer_황화인_자기소개서_2026-09-27.md'
OUTPUT = SOURCE.with_suffix('.pdf')
W, H = A4
LEFT = RIGHT = 72
WIDTH = W - LEFT - RIGHT
NAVY = colors.HexColor('#1F3A5F')
BLUE = colors.HexColor('#4A90C2')
INK = colors.HexColor('#222222')
GRAY = colors.HexColor('#595959')
RULE = colors.HexColor('#9FC5E2')

pdfmetrics.registerFont(TTFont('NotoKR', r'C:\Windows\Fonts\NotoSansKR-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoKR-Bold', r'C:\Windows\Fonts\NotoSansKR-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Code', r'C:\Windows\Fonts\consola.ttf'))
pdfmetrics.registerFontFamily('NotoKR', normal='NotoKR', bold='NotoKR-Bold')

BODY = ParagraphStyle('Body', fontName='NotoKR', fontSize=11, leading=21.5,
                      textColor=INK, spaceAfter=7, wordWrap='CJK',
                      allowWidows=0, allowOrphans=0)
HEADING = ParagraphStyle('Heading', fontName='NotoKR-Bold', fontSize=16,
                         leading=23, textColor=NAVY)
HEADING_DETAIL = ParagraphStyle('HeadingDetail', fontName='NotoKR-Bold', fontSize=12.5,
                                leading=20, textColor=NAVY)
TITLE = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=32,
                      leading=39, textColor=NAVY, alignment=TA_CENTER)
SUBTITLE = ParagraphStyle('Subtitle', fontName='NotoKR', fontSize=18,
                         leading=29, textColor=BLUE, alignment=TA_CENTER)
NAME = ParagraphStyle('Name', fontName='NotoKR-Bold', fontSize=16,
                      leading=28, textColor=NAVY, alignment=TA_CENTER)
LINKS = ParagraphStyle('Links', fontName='NotoKR', fontSize=9.8,
                       leading=18, textColor=BLUE, alignment=TA_CENTER)
TOC_SUB = ParagraphStyle('TocSub', fontName='NotoKR', fontSize=10,
                        leading=16, textColor=GRAY, wordWrap='CJK')

EXTERNAL = [
    ('포트폴리오(PPT)', 'https://canva.link/hwain'),
    ('포트폴리오(Notion)', 'https://root-waterlily-68c.notion.site/AI-AGENT-2d9aa1b4174880489329e83e477efdb3'),
    ('이력서', 'https://immortal0900.github.io/AI_Agent_Developer_hwain_Resume/'),
    ('개발블로그', 'https://immortal0900.github.io/hwain_blog/'),
    ('링크드인', 'https://www.linkedin.com/in/immortal0900/'),
]

# Each bookmark points to an existing paragraph; no prose is inserted into the body.
SUBSECTIONS = {
    1: [('논문에서 효과가', 'ReAct 구성 비교실험'), ('선택 적용 후에도', '출력 오류 추적과 수정')],
    2: [('MEMORIA LABYRINTH는', '화자 혼동의 원인'), ('저는 Mem0가', '기억 저장과 변경 이력'), ('기억이 저장돼', '기억 검색 개선')],
    3: [('직접 사용해보니', '시나리오와 실제 결과 검증'), ('평가기 자체에도', '평가기 오류 교정'),
        ('`SessionStart`에서는', 'SessionStart 문서와 상태 전달'), ('실행해서는 안 되는 명령은', 'PreToolUse 실행 통제'),
        ('커밋 직전에는', 'DB 및 문서 검사')],
    4: [('첨부파일을 구현할 때는', '첨부 등록 실패 처리'), ('기능을 코딩 Agent와', '요구사항 원본과 추출본'),
        ('작업 범위는 Jira', 'Jira 작업 범위와 기록'), ('커밋·푸시·PR 규칙은', '실행 직전 규칙 전달'),
        ('`Stop` 훅은', 'Stop 작업 요약'), ('검증 도구도 Agent가', '실행 결과와 서버 로그 검증')],
    5: [('ALL_FOR_ONE(', '회사 코딩 Agent 비교실험'), ('그래서 Prime Agent와', '품질 목표 54회 비교'),
        ('그 결과 품질 지표는', '품질과 시간에 따른 기준 선택'), ('SENTINEL을 만든 계기는', '결정론적 품질 게이트 SENTINEL 개발')],
}


def display_text(raw: str) -> str:
    return html.unescape(raw).replace(r'\_', '_').replace('\\\n', '\n').strip()


def rich_text(raw: str) -> str:
    parts = re.split(r'(`[^`]+`)', display_text(raw))
    rendered = []
    for part in parts:
        if part.startswith('`') and part.endswith('`'):
            rendered.append('<font name="Code" size="10.4" color="#1F3A5F">' + html.escape(part[1:-1]) + '</font>')
        else:
            rendered.append(html.escape(part).replace('\n', '<br/>'))
    return ''.join(rendered)


raw_source = SOURCE.read_text(encoding='utf-8')
blocks = [b for b in re.split(r'\n\s*\n', raw_source.strip()) if b.strip()]
assert blocks[0] == '# AI Engineer 자기소개서'
body_blocks = blocks[2:] if blocks[1] == '황화인' else blocks[1:]
chapters = []
for block in blocks:
    if block.startswith('## '):
        number = int(re.match(r'## (\d+)\.', block).group(1))
        title = display_text(block[3:])
        main, detail = title.split(': ', 1)
        chapters.append({'number': number, 'title': title, 'main': main, 'detail': detail, 'key': f'chapter-{number}'})
assert len(chapters) == 5
assert 'SENTINEL' in chapters[4]['title']


class Destination(Flowable):
    def __init__(self, key: str, title: str, level: int):
        Flowable.__init__(self)
        self.key, self.title, self.level = key, title, level
        self.width = self.height = 0
        self.keepWithNext = True

    def draw(self):
        pass

    def drawOn(self, canvas, x, y, _sW=0):
        top = min(H - 55, y + 8)
        canvas.bookmarkPage(self.key, fit='XYZ', left=0, top=top, zoom=0)
        canvas.addOutlineEntry(self.title, self.key, level=self.level, closed=False)
        canvas._nav_positions[self.key] = {'page': canvas.getPageNumber(), 'top': H - top, 'title': self.title, 'level': self.level}


class SectionHeading(Flowable):
    def __init__(self, text: str):
        Flowable.__init__(self)
        main, detail = text.split(': ', 1)
        self.paragraph = Paragraph(html.escape(main + ':'), HEADING)
        self.description = Paragraph(html.escape(detail), HEADING_DETAIL)
        self.spaceBefore = 20
        self.spaceAfter = 14
        self.keepWithNext = True

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        _, ph = self.paragraph.wrap(availWidth, availHeight)
        _, dh = self.description.wrap(availWidth, availHeight)
        self.ph, self.dh = ph, dh
        self.height = ph + dh + 13
        return self.width, self.height

    def draw(self):
        self.paragraph.drawOn(self.canv, 0, self.dh + 13)
        self.description.drawOn(self.canv, 0, 10)
        self.canv.setStrokeColor(NAVY)
        self.canv.setLineWidth(1.25)
        self.canv.line(0, 2, self.width, 2)


def draw_cover(canvas, positions):
    canvas.bookmarkPage('contents', fit='Fit')
    canvas.addOutlineEntry('표지 · 목차', 'contents', 0, closed=False)
    canvas._nav_positions['contents'] = {'page': 1, 'top': 0, 'title': '표지 · 목차', 'level': 0}
    canvas.setFillColor(colors.black)
    canvas.setFont('NotoKR-Bold', 20)
    canvas.drawString(LEFT, H - 137, 'AI Engineer 자기소개서')
    canvas.setFont('NotoKR', 13)
    canvas.setFillColor(GRAY)
    canvas.drawString(LEFT, H - 160, '황화인')
    canvas.setStrokeColor(colors.HexColor('#BFBFBF'))
    canvas.setLineWidth(.65)
    canvas.line(LEFT, H - 172, W - RIGHT, H - 172)
    canvas.setFont('NotoKR-Bold', 16)
    canvas.setFillColor(colors.black)
    canvas.drawString(LEFT, H - 211, '목차')

    y = H - 250
    for chapter in chapters:
        canvas.setFillColor(colors.black)
        canvas.setFont('NotoKR', 12)
        canvas.drawString(LEFT, y, chapter['main'])
        number = positions.get(chapter['key'], {}).get('page', 0)
        page_label = f'p. {number}' if number else 'p. -'
        canvas.setFillColor(GRAY)
        canvas.setFont('NotoKR', 11)
        canvas.drawRightString(W - RIGHT, y, page_label)
        label_width = pdfmetrics.stringWidth(chapter['main'], 'NotoKR', 12)
        page_width = pdfmetrics.stringWidth(page_label, 'NotoKR', 11)
        canvas.setStrokeColor(colors.HexColor('#808080'))
        canvas.setLineWidth(.55)
        canvas.setDash(.7, 2.2)
        canvas.line(LEFT + label_width + 8, y + 3, W - RIGHT - page_width - 8, y + 3)
        canvas.setDash()
        desc = Paragraph(html.escape(chapter['detail']), TOC_SUB)
        _, dh = desc.wrap(WIDTH - 28, 48)
        desc.drawOn(canvas, LEFT + 17, y - 8 - dh)
        canvas.linkRect('', chapter['key'], (LEFT - 3, y - 10 - dh, W - RIGHT + 3, y + 17), relative=0, thickness=0)
        y -= max(59, dh + 37)

    canvas.setFont('NotoKR', 9)
    canvas.setFillColor(colors.HexColor('#808080'))
    canvas.drawString(LEFT, y - 25, '목차 항목을 클릭하면 해당 위치로 이동합니다.')
    canvas.drawString(LEFT, y - 43, '세부 항목은 PDF 책갈피에서, 목차 복귀는 각 페이지 하단에서 이용할 수 있습니다.')


def page_decoration(canvas, doc, previous, total):
    if not hasattr(canvas, '_nav_positions'):
        canvas._nav_positions = {}
    canvas.saveState()
    page = canvas.getPageNumber()
    if page == 1:
        draw_cover(canvas, previous)
    else:
        canvas.setFont('NotoKR-Bold', 9)
        canvas.setFillColor(BLUE)
        canvas.drawRightString(W - RIGHT, H - 44, 'AI ENGINEER 황화인')
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(.7)
        canvas.line(LEFT, H - 52, W - RIGHT, H - 52)
        canvas.setFont('NotoKR', 9)
        canvas.drawString(LEFT, 36, '목차로')
        canvas.linkRect('', 'contents', (LEFT - 3, 31, LEFT + 33, 49), relative=0, thickness=0)
    canvas.setFillColor(GRAY)
    canvas.setFont('NotoKR', 9)
    canvas.drawCentredString(W / 2, 36, f'- {page} / {total or "-"} -')
    canvas.restoreState()


def story():
    flow = [Spacer(1, 1), PageBreak(), Spacer(1, 0),
            Paragraph('AI Engineer', TITLE), Paragraph('자기소개서', SUBTITLE),
            Spacer(1, 7), Paragraph('황 화 인', NAME), Spacer(1, 14)]
    # Retain the template's author-provided external link row.
    link_row = ' &nbsp;|&nbsp; '.join(f'<link href="{html.escape(url, quote=True)}" color="#4A90C2"><u>{html.escape(label)}</u></link>' for label, url in EXTERNAL)
    flow += [Paragraph(link_row, LINKS), Spacer(1, 10)]
    section = 0
    found = set()
    for block in body_blocks:
        if block.startswith('## '):
            section += 1
            chapter = chapters[section - 1]
            flow += [Destination(chapter['key'], chapter['main'], 0), SectionHeading(chapter['title'])]
        else:
            for index, (prefix, label) in enumerate(SUBSECTIONS.get(section, [])):
                if display_text(block).startswith(prefix):
                    key = f'section-{section}-{index}'
                    flow.append(Destination(key, label, 1))
                    found.add(key)
            flow.append(Paragraph(rich_text(block), BODY))
    expected = {f'section-{section}-{i}' for section, entries in SUBSECTIONS.items() for i, _ in enumerate(entries)}
    assert found == expected, f'Missing bookmark matches: {expected - found}'
    return flow


def build(path, previous, total):
    doc = BaseDocTemplate(str(path), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT,
                         topMargin=72, bottomMargin=68, title='AI Engineer 자기소개서 - 황화인',
                         author='황화인', subject='AI Engineer 지원 자기소개서')
    frame = Frame(LEFT, 68, WIDTH, H - 72 - 68, leftPadding=0, rightPadding=0,
                  topPadding=0, bottomPadding=0)
    doc.addPageTemplates(PageTemplate('A4', frames=[frame],
                          onPage=lambda c, d: page_decoration(c, d, previous, total)))
    doc.build(story())
    return doc.canv._nav_positions, doc.page


if __name__ == '__main__':
    previous, total = build(WORK / 'pagination-pass.pdf', {}, 0)
    positions, final_total = build(WORK / 'final-render.pdf', previous, total)
    assert total == final_total and positions == previous, 'Pagination changed between passes'
    # Retain named destinations, enable sidebar bookmarks, and publish atomically.
    doc = fitz.open(WORK / 'final-render.pdf')
    doc.set_pagemode('UseOutlines')
    doc.set_pagelayout('OneColumn')
    pending = OUTPUT.with_name(OUTPUT.stem + '.building.pdf')
    doc.save(pending, garbage=4, deflate=True)
    doc.close()
    pending.replace(OUTPUT)
    manifest = {'source': str(SOURCE), 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'output': str(OUTPUT), 'pages': final_total, 'destinations': positions,
                'chapter_pages': {c['key']: positions[c['key']]['page'] for c in chapters}}
    (WORK / 'navigation-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(OUTPUT), 'pages': final_total, 'chapter_pages': manifest['chapter_pages'], 'bookmarks': len(positions)}, ensure_ascii=False))
