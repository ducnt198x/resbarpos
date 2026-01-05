import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type Language = 'en' | 'vi';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  brightness: number;
  setBrightness: (val: number) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Sidebar
    'Home': 'Home',
    'Dashboard': 'Dashboard',
    'Menu': 'Menu',
    'Tables': 'Tables',
    'Orders': 'Orders',
    'Stock': 'Stock',
    'Settings': 'Settings',
    'Logout': 'Logout',
    'More': 'More',
    'Manage': 'Manage & Track',
    'Main Branch': 'Main Branch',
    
    // Dashboard
    'Dashboard Overview': 'Dashboard Overview',
    'Real-time performance metrics': 'Real-time performance metrics',
    'Actual Revenue': 'Actual Revenue',
    'Provisional Revenue': 'Provisional Revenue',
    'Total Orders': 'Total Orders',
    'Avg Ticket': 'Avg Ticket',
    'Revenue Trends': 'Revenue Trends',
    'Hourly breakdown': 'Hourly breakdown',
    'Daily breakdown': 'Daily breakdown',
    'Staff Performance': 'Staff Performance',
    'Top revenue generators': 'Top revenue generators',
    'today': 'today',
    'week': 'week',
    'month': 'month',

    // Menu
    'Manage items': 'Manage items and manual stock',
    'Add Item': 'Add Item',
    'Search...': 'Search...',
    'All': 'All',
    'Coffee': 'Coffee',
    'Non Coffee': 'Non Coffee',
    'Matcha': 'Matcha',
    'Food': 'Food',
    'Current Order': 'Current Order',
    'Subtotal': 'Subtotal',
    'Total Amount': 'Total Amount',
    'Confirm Order': 'Confirm Order',
    'Cart is empty': 'Cart is empty',
    'Your Cart': 'Your Cart',
    'View Cart': 'View Cart',
    'New Menu Item': 'New Menu Item',
    'Edit Item': 'Edit Item',
    'Select Order Type': 'Select Order Type',
    'Dine-in': 'Dine-in',
    'Takeaway': 'Takeaway',
    'Select table': 'Select table',
    
    // Orders
    'Manage & Track': 'Manage & Track',
    'Pending': 'Pending',
    'Cooking': 'Cooking',
    'Ready': 'Ready',
    'Completed': 'Completed',
    'Cancelled': 'Cancelled',
    'Search ID...': 'Search ID...',
    'Table': 'Table',
    'Items': 'Items',
    'Payment': 'Payment',
    'Take Away Order': 'Take Away Order',
    'TAKE AWAY ORDER': 'TAKE AWAY ORDER',
    'Cancel': 'Cancel',
    'Confirm': 'Confirm',
    'Print Bill': 'Print Bill',
    'No orders found': 'No orders found',
    'Created by': 'Created by',
    'Cancel Order': 'Cancel Order',
    'Cash': 'Cash',
    'Card': 'Card',
    'Transfer': 'Transfer',

    // FloorPlan
    'Main Hall': 'Main Hall',
    'Live': 'Live',
    'Editor Mode': 'Editor Mode',
    'Edit Layout': 'Edit Layout',
    'Save Changes': 'Save Changes',
    'Done': 'Done',
    'Guests': 'Guests',
    'Occupied': 'Occupied',
    'Available': 'Available',
    'Empty Table': 'Empty Table',
    'Ready for service': 'Ready for service',
    'Check In & Order': 'Check In & Order',
    'Edit Order': 'Edit Order',
    'Pay': 'Pay',
    'Bill': 'Bill',
    'Total': 'Total',
    'Add Items': 'Add Items',
    'Split / Merge Table': 'Split / Merge Table',
    'Shape': 'Shape',
    'Seats': 'Seats',
    'Table Actions': 'Table Actions',
    'Move Table': 'Move Table',
    'Merge Table': 'Merge Table',
    'From Table': 'From Table',
    'Select an empty table to move to': 'Select an empty table to move to',
    'Select an occupied table to merge with': 'Select an occupied table to merge with',
    'No empty tables available': 'No empty tables available',
    'No other occupied tables': 'No other occupied tables',

    // Inventory
    'Inventory Management': 'Inventory Management',
    'Manage stock': 'Manage stock, alerts and yield estimation',
    'Stock View': 'Stock View',
    'Yield Analysis': 'Yield Analysis',
    'Sync': 'Sync',
    'Total Value': 'Total Value',
    'Low Stock': 'Low Stock',
    'Action Needed': 'Action Needed',
    'All Good': 'All Good',
    'Top Item': 'Top Item',
    'Stock In': 'Stock In',
    'Add new ingredients': 'Add new ingredients',
    'Ingredient Name': 'Ingredient Name',
    'Quantity': 'Quantity',
    'Unit': 'Unit',
    'Category': 'Category',
    'Add Stock': 'Add Stock',
    'Stock Added': 'Stock Added',
    'Inventory List': 'Inventory List',
    'Track all ingredients': 'Track all ingredients',
    'Potential Yield Analysis': 'Potential Yield Analysis',
    'Theoretical max': 'Theoretical max output based on ingredients',
    'Item Name': 'Item Name',
    'Stock Level': 'Stock Level',
    'Est. Yield': 'Est. Yield',
    'Status': 'Status',
    'Action': 'Action',
    'units': 'units',
    'Manual Stock': 'Manual Stock',
    'No recipe defined': 'No recipe defined',

    // Settings
    'System Settings': 'System Settings',
    'Manage configuration': 'Manage system configuration, devices, and account',
    'General': 'General',
    'Language': 'Language',
    'Choose display language': 'Choose display language',
    'Currency': 'Currency',
    'Select preferred currency': 'Select preferred currency unit',
    'Dark Mode': 'Dark Mode',
    'Adjust appearance': 'Adjust appearance interface',
    'Brightness': 'Brightness',
    'Adjust screen brightness': 'Adjust simulated screen brightness',
    'Hardware & Devices': 'Hardware & Devices',
    'Network Printer': 'Network Printer (LAN/WiFi)',
    'Printer Name': 'Printer Name',
    'IP Address': 'IP Address',
    'Connect': 'Connect',
    'Disconnect': 'Disconnect',
    'Connecting': 'Connecting...',
    'Connected': 'Connected',
    'Disconnected': 'Disconnected',
    'Test Print': 'Test Print',
    'Account': 'Account',
    'Change Password': 'Change Password',
    'Update credentials': 'Update your login credentials',
    'End session': 'End current session',
    'Current Password': 'Current Password',
    'New Password': 'New Password',
    'Confirm New Password': 'Confirm New Password',
    'Update': 'Update',

    // Login
    'ResBar POS System': 'ResBar POS System',
    'LoginDescription': 'Streamline your restaurant operations with our comprehensive management solution. Track orders, manage inventory, and analyze performance in real-time.',
    'Sign In': 'Sign In',
    'Create an Account': 'Create an Account',
    'Welcome to ResBar Pos': 'Welcome to ResBar POS',
    'Register text': 'Register to start managing your restaurant.',
    'Login text': 'Please enter your details to sign in.',
    'Full Name': 'Full Name',
    'Email Address': 'Email Address',
    'Password': 'Password',
    'Confirm Password': 'Confirm Password',
    'Remember me': 'Remember me',
    'Forgot password?': 'Forgot password?',
    'Create Account': 'Create Account',
    'Already have an account?': 'Already have an account?',
    'Don\'t have an account?': 'Don\'t have an account?',
  },
  vi: {
    // Sidebar
    'Home': 'Trang chủ',
    'Dashboard': 'Tổng quan',
    'Menu': 'Thực đơn',
    'Tables': 'Sơ đồ bàn',
    'Orders': 'Đơn hàng',
    'Stock': 'Kho hàng',
    'Settings': 'Cài đặt',
    'Logout': 'Đăng xuất',
    'More': 'Thêm',
    'Manage': 'Quản lý & Theo dõi',
    'Main Branch': 'Chi nhánh chính',

    // Dashboard
    'Dashboard Overview': 'Tổng quan kinh doanh',
    'Real-time performance metrics': 'Chỉ số hiệu suất thời gian thực',
    'Actual Revenue': 'Doanh thu thực',
    'Provisional Revenue': 'Doanh thu tạm tính',
    'Total Orders': 'Tổng đơn hàng',
    'Avg Ticket': 'TB đơn hàng',
    'Revenue Trends': 'Xu hướng doanh thu',
    'Hourly breakdown': 'Chi tiết theo giờ',
    'Daily breakdown': 'Chi tiết theo ngày',
    'Staff Performance': 'Hiệu suất nhân viên',
    'Top revenue generators': 'Top nhân viên doanh thu cao',
    'today': 'hôm nay',
    'week': 'tuần này',
    'month': 'tháng này',

    // Menu
    'Manage items': 'Quản lý món và kho thủ công',
    'Add Item': 'Thêm món',
    'Search...': 'Tìm kiếm...',
    'All': 'Tất cả',
    'Coffee': 'Cà phê',
    'Non Coffee': 'Không cà phê',
    'Matcha': 'Matcha/Trà',
    'Food': 'Đồ ăn',
    'Current Order': 'Đơn hiện tại',
    'Subtotal': 'Tạm tính',
    'Total Amount': 'Tổng cộng',
    'Confirm Order': 'Xác nhận đơn',
    'Cart is empty': 'Giỏ hàng trống',
    'Your Cart': 'Giỏ hàng của bạn',
    'View Cart': 'Xem giỏ hàng',
    'New Menu Item': 'Thêm món mới',
    'Edit Item': 'Sửa món',
    'Select Order Type': 'Chọn hình thức',
    'Dine-in': 'Dùng tại bàn',
    'Takeaway': 'Mang về',
    'Select table': 'Chọn bàn',

    // Orders
    'Manage & Track': 'Quản lý & Theo dõi',
    'Pending': 'Chờ xử lý',
    'Cooking': 'Đang chế biến',
    'Ready': 'Sẵn sàng',
    'Completed': 'Hoàn thành',
    'Cancelled': 'Đã hủy',
    'Search ID...': 'Tìm mã đơn...',
    'Table': 'Bàn',
    'Items': 'Món',
    'Payment': 'Thanh toán',
    'Take Away Order': 'Đơn mang về',
    'TAKE AWAY ORDER': 'ĐƠN MANG VỀ',
    'Cancel': 'Hủy bỏ',
    'Confirm': 'Xác nhận',
    'Print Bill': 'In Hóa Đơn',
    'No orders found': 'Không tìm thấy đơn hàng',
    'Created by': 'Tạo bởi',
    'Cancel Order': 'Hủy Đơn Hàng',
    'Cash': 'Tiền mặt',
    'Card': 'Thẻ',
    'Transfer': 'Chuyển khoản',

    // FloorPlan
    'Main Hall': 'Sảnh chính',
    'Live': 'Trực tiếp',
    'Editor Mode': 'Chế độ sửa',
    'Edit Layout': 'Sửa sơ đồ',
    'Save Changes': 'Lưu thay đổi',
    'Done': 'Xong',
    'Guests': 'Khách',
    'Occupied': 'Đang dùng',
    'Available': 'Bàn trống',
    'Empty Table': 'Bàn trống',
    'Ready for service': 'Sẵn sàng phục vụ',
    'Check In & Order': 'Mở bàn & Gọi món',
    'Edit Order': 'Sửa đơn',
    'Pay': 'Thanh toán',
    'Bill': 'Hóa đơn',
    'Total': 'Tổng',
    'Add Items': 'Thêm món',
    'Split / Merge Table': 'Chuyển / Gộp bàn',
    'Shape': 'Hình dáng',
    'Seats': 'Số ghế',
    'Table Actions': 'Thao tác bàn',
    'Move Table': 'Chuyển bàn',
    'Merge Table': 'Gộp bàn',
    'From Table': 'Từ bàn',
    'Select an empty table to move to': 'Chọn bàn trống để chuyển đến',
    'Select an occupied table to merge with': 'Chọn bàn đang dùng để gộp vào',
    'No empty tables available': 'Không có bàn trống',
    'No other occupied tables': 'Không có bàn nào để gộp',

    // Inventory
    'Inventory Management': 'Quản lý kho hàng',
    'Manage stock': 'Quản lý tồn kho và định lượng',
    'Stock View': 'Tồn kho',
    'Yield Analysis': 'Định lượng',
    'Sync': 'Đồng bộ',
    'Total Value': 'Tổng giá trị',
    'Low Stock': 'Sắp hết',
    'Action Needed': 'Cần nhập',
    'All Good': 'Ổn định',
    'Top Item': 'Top nguyên liệu',
    'Stock In': 'Nhập kho',
    'Add new ingredients': 'Thêm nguyên liệu mới',
    'Ingredient Name': 'Tên nguyên liệu',
    'Quantity': 'Số lượng',
    'Unit': 'Đơn vị',
    'Category': 'Danh mục',
    'Add Stock': 'Thêm hàng',
    'Stock Added': 'Đã thêm',
    'Inventory List': 'Danh sách kho',
    'Track all ingredients': 'Theo dõi nguyên liệu',
    'Potential Yield Analysis': 'Phân tích định lượng',
    'Theoretical max': 'Số lượng món tối đa có thể bán',
    'Item Name': 'Tên hàng',
    'Stock Level': 'Tồn kho',
    'Est. Yield': 'Ước tính',
    'Status': 'Trạng thái',
    'Action': 'Thao tác',
    'units': 'đơn vị',
    'Manual Stock': 'Kho thủ công',
    'No recipe defined': 'Chưa có công thức',

    // Settings
    'System Settings': 'Cài đặt hệ thống',
    'Manage configuration': 'Quản lý cấu hình, thiết bị và tài khoản',
    'General': 'Chung',
    'Language': 'Ngôn ngữ',
    'Choose display language': 'Chọn ngôn ngữ hiển thị',
    'Currency': 'Tiền tệ',
    'Select preferred currency': 'Chọn đơn vị tiền tệ',
    'Dark Mode': 'Chế độ tối',
    'Adjust appearance': 'Điều chỉnh giao diện',
    'Brightness': 'Độ sáng',
    'Adjust screen brightness': 'Điều chỉnh độ sáng giả lập',
    'Hardware & Devices': 'Phần cứng & Thiết bị',
    'Network Printer': 'Máy in mạng (LAN/WiFi)',
    'Printer Name': 'Tên máy in',
    'IP Address': 'Địa chỉ IP',
    'Connect': 'Kết nối',
    'Disconnect': 'Ngắt kết nối',
    'Connecting': 'Đang kết nối...',
    'Connected': 'Đã kết nối',
    'Disconnected': 'Ngắt kết nối',
    'Test Print': 'In thử',
    'Account': 'Tài khoản',
    'Change Password': 'Đổi mật khẩu',
    'Update credentials': 'Cập nhật thông tin đăng nhập',
    'End session': 'Kết thúc phiên làm việc',
    'Current Password': 'Mật khẩu hiện tại',
    'New Password': 'Mật khẩu mới',
    'Confirm New Password': 'Xác nhận mật khẩu mới',
    'Update': 'Cập nhật',

    // Login
    'ResBar POS System': 'Hệ thống Quản lý ResBar POS',
    'LoginDescription': 'Tối ưu hóa quy trình vận hành nhà hàng với giải pháp quản lý toàn diện. Theo dõi đơn hàng, kiểm soát kho và phân tích hiệu suất kinh doanh theo thời gian thực.',
    'Sign In': 'Đăng nhập',
    'Create an Account': 'Tạo tài khoản',
    'Welcome to ResBar Pos': 'Chào mừng đến với ResBar POS',
    'Register text': 'Đăng ký để bắt đầu quản lý nhà hàng.',
    'Login text': 'Vui lòng nhập thông tin để đăng nhập.',
    'Full Name': 'Họ tên',
    'Email Address': 'Email',
    'Password': 'Mật khẩu',
    'Confirm Password': 'Xác nhận mật khẩu',
    'Remember me': 'Ghi nhớ đăng nhập',
    'Forgot password?': 'Quên mật khẩu?',
    'Create Account': 'Tạo tài khoản',
    'Already have an account?': 'Đã có tài khoản?',
    'Don\'t have an account?': 'Chưa có tài khoản?',
  }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use lazy initialization for theme to prevent FOUC (Flash of Unstyled Content) and ensure persistence
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme'); // Updated key as requested
      const activeTheme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
      
      // Sync DOM immediately during initialization
      if (activeTheme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      
      return activeTheme;
    }
    return 'dark';
  });

  // Use lazy initialization for language
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as Language) || 'vi'; // Default to 'vi' as requested
    }
    return 'vi';
  });

  // Default brightness 100 (fully bright)
  const [brightness, setBrightness] = useState<number>(100);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, language, setLanguage, brightness, setBrightness, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};