
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FileText, ClipboardCheck, Settings, 
  Menu, X, Leaf, Cloud, CloudOff, RefreshCw, Layers, 
  Clock, LogOut, User as UserIcon, FlaskConical, Users, Activity,
  ChevronDown, Search
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { state, syncStatus } = useAppContext();
  const { user, logout, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      setSearchTerm(''); 
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { 
      name: 'Danh mục', 
      icon: Package,
      children: [
        { name: 'Sản phẩm', path: '/products', icon: Package },
        { name: 'Nguyên liệu', path: '/materials', icon: Layers },
        { name: 'Chỉ tiêu', path: '/criteria', icon: Activity },
      ]
    },
    { 
      name: 'Hồ sơ', 
      icon: FileText,
      children: [
        { name: 'Hồ sơ TCCS', path: '/tccs', icon: FileText },
        { name: 'Công thức sản phẩm', path: '/product-formulas', icon: FlaskConical },
      ]
    },
    { 
      name: 'Nghiệp vụ', 
      icon: Layers,
      children: [
        { name: 'Quản lý Lô', path: '/batches', icon: Layers },
        { name: 'Kiểm soát Lab', path: '/test-results', icon: ClipboardCheck },
      ]
    },
    { 
      name: 'Hệ thống', 
      icon: Settings,
      children: [
        { name: 'Người dùng', path: '/users', icon: Users, adminOnly: true },
        { name: 'Cấu hình', path: '/settings', icon: Settings },
      ]
    }
  ];

  const handleLogout = async () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      await logout();
      navigate('/login');
    }
  };

  const getSyncStatusContent = () => {
    const lastSyncTime = state.lastSync ? new Date(state.lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '---';
    
    switch(syncStatus) {
      case 'SAVING':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          text: 'text-amber-600',
          icon: <RefreshCw size={14} className="animate-spin" />,
          label: 'Đang lưu...',
          desc: 'Vui lòng giữ kết nối'
        };
      case 'ERROR':
        return {
          bg: 'bg-red-50',
          border: 'border-red-100',
          text: 'text-red-600',
          icon: <CloudOff size={14} />,
          label: 'Lỗi đồng bộ',
          desc: 'Kiểm tra lại thao tác'
        };
      default:
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
          text: 'text-[#009639]',
          icon: <Cloud size={14} />,
          label: 'Đã đồng bộ',
          desc: lastSyncTime
        };
    }
  };

  const status = getSyncStatusContent();

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Fixed Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 px-4 lg:px-8 flex items-center justify-between shadow-sm transition-all">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#009639] p-2 rounded-xl text-white shadow-lg shadow-emerald-100">
            <Leaf size={20} fill="currentColor" />
          </div>
          <div className="flex flex-col">
             <span className="font-black text-lg text-slate-800 tracking-tight leading-none">V-BIOTECH</span>
             <span className="text-[9px] font-bold text-[#009639] uppercase tracking-wider">Quality Management</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-2 px-6">
          {navItems.map((item, idx) => {
            if (item.children) {
               const visibleChildren = item.children.filter(child => !child.adminOnly || role === 'ADMIN');
               if (visibleChildren.length === 0) return null;
               const isChildActive = visibleChildren.some(child => location.pathname === child.path || location.pathname.startsWith(child.path));
               
               return (
                 <div key={idx} className="relative group">
                    <button className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all ${isChildActive ? 'bg-emerald-50 text-[#009639]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
                       <item.icon size={16} className={isChildActive ? "stroke-[2.5px]" : "stroke-2"} /> {item.name} <ChevronDown size={14} />
                    </button>
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left z-50">
                       {visibleChildren.map(child => (
                         <Link key={child.path} to={child.path} className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase hover:bg-slate-50 transition-colors ${location.pathname === child.path ? 'text-[#009639] bg-emerald-50/50' : 'text-slate-600'}`}>
                            <child.icon size={16} /> {child.name}
                         </Link>
                       ))}
                    </div>
                 </div>
               );
            } else {
               if (item.path) {
                 const isActive = location.pathname === item.path;
                 return (
                   <Link 
                     key={item.path} 
                     to={item.path}
                     className={`
                       flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap
                       ${isActive 
                         ? 'bg-emerald-50 text-[#009639] shadow-sm ring-1 ring-emerald-100' 
                         : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}
                     `}
                   >
                     <item.icon size={16} className={isActive ? "stroke-[2.5px]" : "stroke-2"} /> 
                     {item.name}
                   </Link>
                 );
               }
               return null;
            }
          })}
        </nav>

        {/* Quick Search */}
        <div className="hidden lg:flex flex-1 max-w-sm px-6">
          <form onSubmit={handleSearch} className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#009639] transition-colors" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm nhanh..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-transparent focus:bg-white focus:border-emerald-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-50 transition-all placeholder:text-slate-400"
            />
          </form>
        </div>

        {/* Right Side: User & Sync */}
        <div className="flex items-center gap-4 shrink-0">
           {/* Sync Status Indicator */}
           <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border ${status.bg} ${status.border} transition-all`}>
              <div className={`w-2 h-2 rounded-full ${syncStatus === 'SAVING' ? 'bg-amber-500 animate-pulse' : syncStatus === 'ERROR' ? 'bg-red-500' : 'bg-[#009639]'}`} />
              <div className="flex flex-col leading-none">
                 <span className={`text-[9px] font-black uppercase ${status.text}`}>{status.label}</span>
                 <span className="text-[8px] font-bold text-slate-400">{status.desc}</span>
              </div>
           </div>

           {/* User Profile */}
           <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                 <Link to="/account" className="text-[11px] font-bold text-slate-800 truncate max-w-[120px] block hover:text-[#009639] transition-colors">
                    {user?.email}
                 </Link>
                 <button onClick={handleLogout} className="text-[9px] font-bold text-red-500 uppercase hover:underline flex items-center justify-end gap-1 ml-auto">
                    Đăng xuất <LogOut size={10} />
                 </button>
              </div>
              <Link to="/account" className="w-9 h-9 rounded-xl bg-emerald-100 text-[#009639] flex items-center justify-center font-bold shadow-inner overflow-hidden hover:ring-2 hover:ring-emerald-200 transition-all">
                 {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                 ) : (
                    user?.email?.[0].toUpperCase() || <UserIcon size={18} />
                 )}
              </Link>
           </div>

           {/* Mobile Menu Button */}
           <button onClick={() => setMobileMenuOpen(true)} className="xl:hidden p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
             <Menu size={24} />
           </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] xl:hidden">
           <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />
           <aside className="absolute top-0 right-0 w-80 h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-2">
                    <div className="bg-[#009639] p-1.5 rounded-lg text-white">
                        <Leaf size={16} fill="currentColor" />
                    </div>
                    <span className="font-black text-slate-800">MENU</span>
                 </div>
                 <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                 {navItems.map((item, idx) => {
                    if (item.children) {
                       const visibleChildren = item.children.filter(child => !child.adminOnly || role === 'ADMIN');
                       if (visibleChildren.length === 0) return null;
                       return (
                         <div key={idx} className="space-y-1 py-2">
                            <div className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><item.icon size={12}/> {item.name}</div>
                            {visibleChildren.map(child => {
                               const isActive = location.pathname === child.path;
                               return (
                                 <Link key={child.path} to={child.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isActive ? 'bg-emerald-50 text-[#009639]' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    <child.icon size={18} /> {child.name}
                                 </Link>
                               );
                            })}
                         </div>
                       );
                    } else if (item.path) {
                       const isActive = location.pathname === item.path;
                       return (
                         <Link 
                           key={item.path} 
                           to={item.path} 
                           onClick={() => setMobileMenuOpen(false)}
                           className={`
                             flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all
                             ${isActive 
                               ? 'bg-emerald-50 text-[#009639] shadow-sm' 
                               : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}
                           `}
                         >
                           <item.icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-2"} /> {item.name}
                         </Link>
                       );
                    }
                    return null;
                 })}
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50/30 space-y-4">
                 {/* Mobile Sync Status */}
                 <div className={`flex items-center gap-3 p-3 rounded-xl border ${status.bg} ${status.border}`}>
                    <div className={`p-2 rounded-full bg-white shadow-sm ${status.text}`}>
                        {status.icon}
                    </div>
                    <div>
                        <p className={`text-[10px] font-black uppercase ${status.text}`}>{status.label}</p>
                        <p className="text-[9px] font-bold text-slate-400">{status.desc}</p>
                    </div>
                 </div>

                 <button onClick={handleLogout} className="flex items-center gap-2 w-full justify-center py-3 bg-white border border-slate-200 text-red-600 rounded-xl font-black text-xs uppercase shadow-sm hover:bg-red-50 hover:border-red-100 transition-all">
                    <LogOut size={16} /> Đăng xuất
                 </button>
              </div>
           </aside>
        </div>
      )}

      <main className="flex-1 pt-16 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth hide-scrollbar">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
             {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
