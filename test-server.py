#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time
import os
import sys

# 포트 설정
PORT = 8000

# 현재 디렉토리의 파일 목록
def list_files():
    print("📁 현재 디렉토리 파일 목록:")
    for root, dirs, files in os.walk('.'):
        level = root.replace('.', '').count('/')
        indent = '  ' * level
        print(f"{indent}📁 {root}/")
        for file in files:
            print(f"{indent}    📄 {file}")
        for dir in dirs:
            print(f"{indent}    📁 {dir}/")

# 파일 내용 확인
def show_file_content(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            print(f"\n📄 {filename} 내용 (처음 100자):")
            print(content[:100] + ("..." if len(content) > 100 else ""))
            print(f"총 {len(content)}자\n")
    except Exception as e:
        print(f"❌ 파일 읽기 오류: {e}")

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_page()
        elif self.path == '/files':
            list_files()
            self.send_response(200)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_page()
        elif self.path.startswith('/show/'):
            filename = self.path[6:]  # '/show/' 제거
            if os.path.exists(filename):
                show_file_content(filename)
            else:
                self.send_response(404)
                self.end_page()
        else:
            self.send_response(404)
            self.end_page()

    def end_page(self):
        content = f"""
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 친구 TTS 테스트 서버</title>
    <style>
        body {{
            font-family: 'Noto Sans KR', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 20px;
        }}
        .content {{
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .file-list {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .file-content {{
            background: #f0f8ff;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            white-space: pre-wrap;
            font-family: monospace;
        }}
        button {{
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }}
        button:hover {{
            background: #45a049;
        }}
        .nav {{
            margin-bottom: 20px;
        }}
        .nav a {{
            display: inline-block;
            margin-right: 15px;
            padding: 8px 16px;
            background: #e9ecef;
            color: #333;
            text-decoration: none;
            border-radius: 5px;
        }}
        .nav a:hover {{
            background: #dee2e6;
        }}
        .status {{
            margin: 10px 0;
            padding: 10px;
            background: #e8f5e8;
            border-radius: 5px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🎤 AI 친구 TTS 테스트 서버</h1>
        <p>로컬에서 TTS 기능을 테스트합니다</p>
    </div>
    
    <div class="content">
        <div class="nav">
            <a href="/">🏠 홈</a>
            <a href="/files">📁 파일 목록</a>
            <a href="/show/index.html">📄 index.html</a>
            <a href="/show/supertonic-tts.js">📄 supertonic-tts.js</a>
            <a href="/show/script.js">📄 script.js</a>
            <a href="/show/style.css">📄 style.css</a>
        </div>
        
        <div class="status">
            <h3>🔗 서버 상태</h3>
            <p>서버가 정상적으로 실행 중입니다. 포트: {PORT}</p>
            <p><a href="http://localhost:{PORT}" target="_blank">http://localhost:{PORT}</a></p>
        </div>
        
        <div class="file-list">
            <h3>📁 현재 디렉토리 파일 목록</h3>
            {files_list}
        </div>
        
        <div class="file-content">
            <h3>📄 파일 내용</h3>
            {file_content}
        </div>
    </div>
</body>
</html>
        """
        
        # 파일 목록 생성
        files_html = ""
        for root, dirs, files in os.walk('.'):
            level = root.replace('.', '').count('/')
            indent = '  ' * level
            files_html += f"{indent}📁 {root}/<br>"
            for file in files:
                files_html += f'{indent}&nbsp;&nbsp;&nbsp;<a href="/show/{file}">📄 {file}</a><br>'
            for dir in dirs:
                files_html += f'{indent}&nbsp;&nbsp;&nbsp;📁 {dir}/<br>'
        
        content = content.replace("{files_list}", files_html)
        
        # 파일 내용이 있으면 표시
        if hasattr(self, 'current_file'):
            try:
                with open(self.current_file, 'r', encoding='utf-8') as f:
                    file_content_html = f"<pre>{f.read()[:1000]}</pre>"
                    content = content.replace("{file_content}", file_content_html)
            except Exception as e:
                file_content_html = f"<p style='color: red;'>파일 읽기 오류: {e}</p>"
                    content = content.replace("{file_content}", file_content_html)
        
        self.wfile.write(content.encode('utf-8'))

def log_request(self):
    timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {self.client_address[0]} {self.command} {self.path}")

def run_server():
    server_address = ('', PORT)
    print(f"🚀 서버 시작: http://localhost:{PORT}")
    print(f"📁 현재 작업 디렉토리: {os.getcwd()}")
    print("📋 사용 가능한 명령어:")
    print("  /files - 파일 목록 보기")
    print("  /show/filename - 파일 내용 보기")
    print("  Ctrl+C로 서버 종료")
    
    try:
        httpd = http.server.HTTPServer(server_address, CustomHTTPRequestHandler)
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버 종료")
        sys.exit(0)
    except Exception as e:
        print(f"❌ 서버 오류: {e}")
        sys.exit(1)

if __name__ == '__main__':
    run_server()
