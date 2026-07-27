import 'package:flutter/material.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({Key? key}) : super(key: key);

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, dynamic>> _pages = [
    {
      "icon": Icons.computer_rounded,
      "color": const Color(0xFF38BDF8),
      "title": "PC Host 실행하기",
      "desc": "Windows PC에서 AnyRemote_Host.exe를 실행하세요.\n설치 없이 즉시 시작됩니다.",
      "tip": "💡 PC 화면에 표시되는 QR 코드로 쉽고 빠르게 연결할 수 있습니다."
    },
    {
      "icon": Icons.qr_code_scanner_rounded,
      "color": const Color(0xFF4ADE80),
      "title": "QR 스캔 & 자동 발견",
      "desc": "앱에서 [QR 스캔] 버튼을 눌러 PC 화면의 QR 코드를 스캔하거나\n동일 Wi-Fi 내의 PC를 자동으로 찾아 연결하세요.",
      "tip": "🌐 Cloudflare 터널을 통해 어디서나 원격 접속이 가능합니다."
    },
    {
      "icon": Icons.touch_app_rounded,
      "color": const Color(0xFFFCD34D),
      "title": "직관적인 스마트 제어",
      "desc": "• 손가락 2개: 화면 핀치 줌 & 자유로운 뷰포트 이동\n• 🖐️ 드래그 모드: 파일/창 드래그 앤 드롭\n• 📜 스크롤 모드: 웹페이지 & 문서 마우스 휠 스크롤",
      "tip": "⚡ 하단 툴바에서 가상 키보드 및 창 관리자를 사용할 수 있습니다."
    },
  ];

  void _onFinish() {
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.desktop_windows_rounded, color: Color(0xFF38BDF8), size: 24),
                      SizedBox(width: 8),
                      Text(
                        "AnyRemote 가이드",
                        style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: _onFinish,
                    child: const Text("건너뛰기", style: TextStyle(color: Colors.white60)),
                  ),
                ],
              ),
            ),

            // Page View
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (idx) => setState(() => _currentPage = idx),
                itemCount: _pages.length,
                itemBuilder: (context, index) {
                  final item = _pages[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 110,
                          height: 110,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: (item['color'] as Color).withValues(alpha: 0.15),
                            border: Border.all(color: (item['color'] as Color).withValues(alpha: 0.6), width: 2),
                          ),
                          child: Icon(item['icon'] as IconData, size: 54, color: item['color'] as Color),
                        ),
                        const SizedBox(height: 32),
                        Text(
                          item['title'] as String,
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          item['desc'] as String,
                          style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.5),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Text(
                            item['tip'] as String,
                            style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 12, height: 1.4),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Bottom Navigation
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Page Indicators
                  Row(
                    children: List.generate(
                      _pages.length,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        margin: const EdgeInsets.only(right: 6),
                        width: _currentPage == i ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _currentPage == i ? const Color(0xFF38BDF8) : Colors.white24,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ),

                  // Next / Finish Button
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0284C7),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      if (_currentPage < _pages.length - 1) {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.ease,
                        );
                      } else {
                        _onFinish();
                      }
                    },
                    child: Text(
                      _currentPage == _pages.length - 1 ? "시작하기 🚀" : "다음",
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
