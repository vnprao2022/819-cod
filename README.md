# Sổ tay sử dụng Call of Dragons Stats — Server 819

Website: [https://819-cod-stat.vercel.app](https://819-cod-stat.vercel.app)

Tài liệu này dành cho người tiếp quản việc vận hành website khi quản lý chính vắng mặt. Đây là hướng dẫn sử dụng và quản lý dữ liệu, không phải hướng dẫn cài đặt hoặc lập trình.

## Website dùng để làm gì?

Website tập trung dữ liệu người chơi Server 819 để:

- xem thống kê tổng quan theo từng kỳ dữ liệu;
- tra cứu và xếp hạng người chơi;
- lưu các thông tin quản lý không có trong file Excel;
- liên kết tài khoản chính với tài khoản farm;
- tính bảng xếp hạng thưởng tuần;
- theo dõi người đang hoạt động, đã di cư, nghỉ game hoặc đã nhận vé nghỉ;
- giữ lại hồ sơ cuối của người đã di cư ngay cả khi dataset cũ bị xóa.

Luồng vận hành thông thường:

```text
Xuất Excel mới → Đăng nhập quản trị → Xem trước → Import
→ Kiểm tra Tổng quan và Xếp hạng → Cập nhật thông tin riêng
→ Kiểm tra liên kết farm → Tính thưởng tuần
```

## Quyền truy cập

### Người xem

Các trang Tổng quan, Xếp hạng, Người chơi, Tính thưởng tuần và Cài đặt có thể được mở từ thanh điều hướng bên trái.

### Người quản trị

Trang quản trị: [https://819-cod-stat.vercel.app/tuan.html](https://819-cod-stat.vercel.app/tuan.html)

Tài khoản và mật khẩu quản trị phải được bàn giao qua kênh riêng. Không ghi mật khẩu vào README, nhóm chat công khai hoặc file Excel.

Người quản trị có thể:

- import, thay thế và xóa dataset Excel;
- chỉnh thông tin riêng của người chơi;
- gắn tài khoản farm;
- đặt Tier, binh chủng, trạng thái và ghi chú.

## 1. Trang Tổng quan

Trang Tổng quan dùng để kiểm tra nhanh tình hình của kỳ dữ liệu đang chọn.

### Chọn kỳ dữ liệu

Chọn khoảng ngày tại ô **Dữ liệu**. Kỳ được chọn sẽ được ghi nhớ trên trình duyệt và tiếp tục được sử dụng khi chuyển sang các trang khác.

### Các số liệu chính

- **T4 / T5:** chỉ tính tài khoản có lực chiến trên 20M. Tài khoản đã được đánh dấu T5 sẽ vào nhóm T5; những tài khoản đủ điều kiện còn lại được tính là T4.
- **Tổng tài khoản:** số người trong dataset đang chọn, không cộng hồ sơ di cư được lưu riêng.
- **Tổng lực chiến, Top 300, Top 200, trung bình và cao nhất.**
- **Tổng tử vong, công trạng, trị liệu và thu thập.**
- **Số người có bảo vật đỏ:** đếm người được đánh dấu Artifact = Yes trong trang quản trị.
- **Phân bố lực chiến:** chia tài khoản theo các mốc 0–20M, 20–40M, 40–60M, 60–80M, 80–100M và trên 100M.

Sau mỗi lần import, nên vào trang này trước để kiểm tra tổng số tài khoản, ngày dữ liệu và các tổng lớn có hợp lý hay không.

## 2. Trang Xếp hạng

Trang Xếp hạng dùng để xem danh sách, tìm kiếm, sắp xếp và lọc người chơi.

### Bộ lọc trạng thái

Bộ lọc mặc định là **Đang hoạt động**, vì vậy người đã di cư hoặc nghỉ game không xuất hiện ngay.

- **Tất cả người chơi:** hiện mọi trạng thái.
- **Đang hoạt động:** người đang có trong dữ liệu và không bị đặt trạng thái khác.
- **Đã di cư:** người được lưu trong kho di cư hoặc được quản trị viên đánh dấu thủ công.
- **Nghỉ game:** trạng thái do quản trị viên đặt.
- **Đã tặng vé nghỉ ngơi:** trạng thái do quản trị viên đặt.

Lưu ý: ô tìm kiếm chỉ tìm trong nhóm trạng thái đang chọn. Nếu không tìm thấy một người, hãy đổi sang **Tất cả người chơi** rồi tìm lại bằng Player ID.

### Các thao tác khác

- Nhập tên hoặc Player ID để tìm.
- Bấm tiêu đề cột để sắp xếp tăng/giảm.
- Bấm **Cột** để chọn các chỉ số muốn hiển thị.
- Mỗi trang hiển thị tối đa 50 người.
- Bấm tên hoặc Player ID để mở trang chi tiết.

Player ID là mã nhận diện chính. Tên người chơi có thể thay đổi nhưng dữ liệu tùy chỉnh vẫn đi theo Player ID.

## 3. Trang Người chơi

Trang Người chơi dùng để tra cứu hồ sơ đầy đủ theo tên hoặc Player ID.

Thông tin hiển thị gồm:

- hạng, lực chiến hiện tại và lực chiến cao nhất;
- tử vong, công trạng và tỷ lệ M/P;
- thu thập, trị liệu và các chỉ số liên minh;
- công trạng theo từng binh chủng;
- Deco, bảo vật đỏ, binh chủng chính, Tier và ghi chú;
- các tài khoản farm đã được liên kết.

Người đã di cư vẫn có thể mở trang chi tiết. Website sử dụng snapshot cuối cùng đã lưu trong kho di cư.

## 4. Trang Tính thưởng tuần

Trang này tạo bảng Top 100 theo một tiêu chí và có thể cộng thêm chỉ số từ tài khoản farm.

### Cách tính

1. Chọn kỳ dữ liệu.
2. Chọn tiêu chí, ví dụ công trạng, tử vong, trị liệu, thu thập, đóng góp liên minh, xây dựng, phá hủy, viện trợ tài nguyên, trợ giúp liên minh hoặc Behemoth.
3. Chọn số tài khoản farm được cộng, từ 0 đến 10.
4. Bấm **Tính Top 100**.

Với mỗi tài khoản chính, hệ thống lấy:

```text
Điểm tài khoản chính
+ điểm của N tài khoản farm cao nhất theo đúng tiêu chí đang chọn
= điểm tổng
```

Một tài khoản đã được gắn làm farm sẽ không xuất hiện lần nữa như tài khoản chính trong bảng thưởng.

### Kiểm tra trước khi chốt thưởng

- Kiểm tra các liên kết farm trong trang quản trị.
- Chọn đúng kỳ dữ liệu và đúng tiêu chí.
- Kiểm tra số farm được cộng.
- Mở một vài tài khoản đầu bảng để đối chiếu.

Quan trọng: trang thưởng hiện sử dụng toàn bộ danh sách được tải, kể cả hồ sơ có trạng thái di cư hoặc nghỉ nếu chúng có mặt trong danh sách. Trước khi chốt thưởng, người quản lý phải kiểm tra các trường hợp này hoặc đối chiếu với bảng Xếp hạng.

## 5. Trang Cài đặt

Trang Cài đặt chỉ dùng để xem thông tin lưu trữ:

- Server hiện tại;
- số dataset;
- số hồ sơ có dữ liệu tùy chỉnh;
- danh sách kỳ dữ liệu và tên file nguồn.

Trang này không dùng để sửa hoặc xóa dữ liệu. Muốn quản lý dữ liệu phải vào trang quản trị `tuan.html`.

## 6. Đổi ngôn ngữ

Bộ chọn ngôn ngữ nằm ở cuối thanh điều hướng. Website hỗ trợ:

- VI — Tiếng Việt;
- EN — English;
- KO — 한국어.

## 7. Quản lý thông tin người chơi

Vào `tuan.html`, đăng nhập và chọn tab **Accounts**.

### Tìm và mở hồ sơ

1. Chọn kỳ dữ liệu.
2. Tìm theo tên hoặc Player ID.
3. Bấm vào hàng của người chơi.
4. Chỉnh thông tin rồi bấm **Lưu thay đổi**.
5. Chỉ rời trang sau khi thấy thông báo lưu thành công.

### Ý nghĩa các trường quản trị

| Trường | Mục đích |
|---|---|
| Deco (%) | Phần trăm Deco được quản lý nhập thủ công |
| Artifact | Đánh dấu người có bảo vật đỏ |
| Main troop | Binh chủng chính: Bộ binh, Kỵ binh, Cung thủ hoặc Pháp sư |
| Tier | T4 hoặc T5; ảnh hưởng thống kê T4/T5 trên Tổng quan |
| Team | Nhóm/đội nội bộ |
| Status | Active, Migrated, Quit hoặc Rest ticket given |
| Note | Ghi chú tự do cho người quản lý |
| Farm Accounts | Các Player ID farm thuộc tài khoản chính |

Những trường này được lưu riêng, không bị ghi đè khi import Excel mới hoặc thay thế dataset.

### Liên kết tài khoản farm

1. Mở tài khoản chính.
2. Bấm **Add farm**.
3. Tìm farm theo tên hoặc Player ID.
4. Bấm kết quả để thêm.
5. Có thể xóa liên kết bằng nút x bên cạnh farm.
6. Bấm **Lưu thay đổi**.

Liên kết farm được sử dụng trực tiếp trong trang Tính thưởng tuần.

## 8. Import Excel và quản lý dataset

Trong `tuan.html`, chọn tab **Import Excel & Datasets**.

### Yêu cầu đối với file

- Định dạng `.xlsx`.
- Dung lượng tối đa 4 MB.
- Website hiện chỉ nhận Server 819.
- Tên file phải đúng mẫu:

```text
819_YYYY-MM-DD_YYYY-MM-DD.xlsx
```

Ví dụ:

```text
819_2026-08-18_2026-08-18.xlsx
```

- Hàng đầu tiên phải là tiêu đề cột.
- Bắt buộc có cột **ID Nhân Vật**.
- Website đọc sheet đang hoạt động đầu tiên trong file.

Các cột thường dùng gồm Hạng, ID Nhân Vật, Tên Nhân Vật, Lực Chiến Hiện Tại, Lực Chiến Cao Nhất Theo Lịch Sử, Tử Vong, Tổng Công Trạng, Thu Thập, Trị Liệu và các chỉ số liên minh.

### Import kỳ mới

1. Bấm **Import Excel**.
2. Chọn file đúng tên và đúng Server 819.
3. Kiểm tra màn hình xem trước: tên file, kỳ dữ liệu, số tài khoản và cảnh báo ID trùng.
4. Nếu có cảnh báo Player ID trùng, nên sửa file trước khi tiếp tục.
5. Bấm **Confirm Import**.
6. Chờ thông báo thành công.
7. Mở Tổng quan và Xếp hạng để kiểm tra.

Không đóng tab hoặc bấm lại nút import khi hệ thống đang xử lý.

### Thay thế một dataset

Dùng **Replace Excel** khi cần sửa file của đúng một kỳ đã import.

- File thay thế phải có cùng khoảng ngày với dataset cũ.
- Dữ liệu lấy từ Excel của kỳ đó sẽ được thay thế.
- Deco, Artifact, binh chủng chính, Tier, Team, trạng thái, ghi chú và liên kết farm vẫn được giữ.
- Nếu thay thế dataset mới nhất, cơ chế người di cư vẫn được cập nhật.

### Xóa một dataset

Bấm **Delete** và đọc kỹ kỳ dữ liệu trước khi xác nhận.

Khi xóa:

- dữ liệu thống kê Excel của kỳ đó bị xóa;
- dữ liệu tùy chỉnh của người chơi vẫn còn;
- snapshot người đã di cư vẫn còn trong kho riêng;
- không có thùng rác hoặc nút hoàn tác trên website.

Muốn khôi phục một dataset đã xóa, cần import lại đúng file Excel gốc. Vì vậy luôn giữ bản sao file Excel nguồn bên ngoài website.

## 9. Cơ chế người chơi đã di cư

Người di cư được lưu trong một kho JSON riêng, không phụ thuộc vào việc còn giữ dataset cũ hay không.

Khi import dataset mới nhất:

1. Website xác định những Player ID đã có trước đây nhưng không còn trong file mới.
2. Bản ghi cuối cùng của họ được lưu vào kho di cư.
3. Họ xuất hiện trong bộ lọc **Đã di cư** trên trang Xếp hạng.
4. Trang chi tiết vẫn đọc được snapshot cuối.
5. Nếu Player ID xuất hiện trở lại trong một lần import sau, họ được tự động gỡ khỏi kho di cư.

Xóa dataset không xóa kho di cư. Trạng thái thủ công do quản trị viên đặt có thể thay đổi nhóm hiển thị của người chơi, vì vậy chỉ chỉnh Status khi thực sự cần.

## 10. Quy trình đề xuất sau mỗi lần cập nhật

1. Lưu file Excel gốc vào thư mục lưu trữ chung của đội.
2. Kiểm tra tên file và kỳ ngày.
3. Import và kiểm tra số tài khoản ở màn hình xem trước.
4. Mở Tổng quan, xác nhận ngày và các tổng số.
5. Mở Xếp hạng với bộ lọc **Đang hoạt động**.
6. Mở bộ lọc **Đã di cư** để kiểm tra người mới biến mất.
7. Kiểm tra một vài tài khoản T5 và bảo vật đỏ.
8. Cập nhật farm, trạng thái hoặc ghi chú nếu cần.
9. Chạy thử bảng Tính thưởng tuần trước khi công bố.
10. Chỉ xóa dataset cũ sau khi đã xác nhận dữ liệu mới hoạt động đúng.

## 11. Xử lý sự cố thường gặp

### Không tìm thấy người chơi

- Chuyển bộ lọc Xếp hạng sang **Tất cả người chơi**.
- Tìm bằng Player ID thay vì tên.
- Kiểm tra đang chọn đúng kỳ dữ liệu.
- Thử tìm tại trang Người chơi.

### Bộ lọc Đã di cư hiện 0

- Dataset đầu tiên không có kỳ trước để so sánh.
- Người chơi có thể đã xuất hiện lại và được gỡ khỏi kho di cư.
- Tải lại trang sau khi import hoàn tất.
- Nếu vẫn bất thường, không xóa dataset mới; ghi lại kỳ dữ liệu và báo người phụ trách kỹ thuật.

### Import bị từ chối

Kiểm tra lần lượt:

- file có phải `.xlsx` hay không;
- dung lượng có vượt 4 MB hay không;
- tên có đúng `819_YYYY-MM-DD_YYYY-MM-DD.xlsx` hay không;
- hàng tiêu đề có cột **ID Nhân Vật** hay không;
- file Replace có đúng cùng khoảng ngày hay không.

### Số liệu thưởng không đúng

- Kiểm tra tiêu chí và số farm được cộng.
- Kiểm tra farm có được liên kết đúng tài khoản chính không.
- Kiểm tra cùng một farm có bị gắn nhầm cho nhiều người không.
- Kiểm tra trạng thái di cư/nghỉ của các tài khoản đầu bảng.

### Đã xóa nhầm dataset

Dữ liệu tùy chỉnh và kho di cư vẫn còn, nhưng số liệu Excel của kỳ đó cần được phục hồi bằng cách import lại file Excel gốc có cùng tên kỳ.

## 12. Nội dung cần bàn giao cho người quản lý kế tiếp

- đường dẫn website;
- đường dẫn trang `tuan.html`;
- tài khoản quản trị qua kênh bảo mật;
- quyền truy cập GitHub và Vercel nếu người đó phụ trách kỹ thuật;
- thư mục lưu các file Excel gốc;
- quy ước đặt tên file;
- quy tắc gắn farm, Tier, bảo vật đỏ và trạng thái nội bộ;
- lịch import và lịch chốt thưởng của đội.

## Giới hạn hiện tại

- Website đang được cấu hình cho Server 819.
- Không có nút hoàn tác khi xóa dataset.
- Không chỉnh trực tiếp số liệu Excel trên website; phải sửa file rồi Replace.
- Trang thưởng chưa tự loại mọi trạng thái di cư/nghỉ khỏi phép tính.
- Thông tin quản trị và ghi chú phụ thuộc vào Player ID, không phụ thuộc tên người chơi.
