# 어디까지 - 거리 측정 웹앱

출발지와 도착지를 OpenStreetMap의 Nominatim에서 검색하고, 선택한 장소 사이의 자동차 주행 거리를 OSRM으로 계산하는 정적 웹앱입니다.

## 실행

프로젝트 폴더를 로컬 정적 HTTP 서버로 열거나 정적 웹 호스팅에 배포하면 됩니다. 빌드 단계, 서버 함수, Redis, API 키 또는 환경변수가 필요하지 않습니다. GitHub 저장소에 올린 뒤 Vercel에서 해당 저장소를 Import하면 별도 설정 없이 배포할 수 있습니다.

## 데이터 제공 서비스

- 장소 검색: [Nominatim](https://nominatim.openstreetmap.org/)
- 자동차 경로 및 거리: [OSRM demo server](https://router.project-osrm.org/)
- 경로 지도: [Leaflet](https://leafletjs.com/)과 [OpenStreetMap 타일](https://www.openstreetmap.org/)

장소 검색은 입력할 때마다 자동 호출하지 않고 사용자가 검색을 요청할 때 실행하며, Nominatim 사용 정책에 맞춰 요청 간격을 제한합니다. 공개 서비스는 사용량 정책 및 가용성에 따라 제한될 수 있습니다. 검색어는 Nominatim으로, 선택한 좌표는 OSRM으로 전송됩니다.
