@echo off
echo 启动小剧场生成器HTTP服务器...
echo.
echo 正在检查Python环境...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Python环境
    echo 请安装Python 3.x: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Python环境检查通过
echo.
echo 启动服务器...
python server.py

pause
























