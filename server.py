#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的HTTP服务器，正确处理CSS文件的MIME类型
用于解决 'text/html' MIME type 错误
"""

import http.server
import socketserver
import os
import mimetypes

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        """重写MIME类型猜测，确保CSS文件返回正确的类型"""
        mimetype, encoding = mimetypes.guess_type(path)
        
        # 强制设置CSS文件的MIME类型
        if path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.json'):
            return 'application/json'
        
        return mimetype

    def end_headers(self):
        """添加CORS头部，允许跨域请求"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def run_server(port=8000):
    """启动HTTP服务器"""
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", port), CustomHTTPRequestHandler) as httpd:
        print(f"🚀 服务器启动成功!")
        print(f"📁 服务目录: {os.getcwd()}")
        print(f"🌐 访问地址: http://127.0.0.1:{port}")
        print(f"📝 支持的文件类型:")
        print(f"   - CSS文件: text/css")
        print(f"   - JS文件: application/javascript")
        print(f"   - JSON文件: application/json")
        print(f"   - 其他文件: 自动检测")
        print(f"\n按 Ctrl+C 停止服务器")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n🛑 服务器已停止")

if __name__ == "__main__":
    run_server()
























