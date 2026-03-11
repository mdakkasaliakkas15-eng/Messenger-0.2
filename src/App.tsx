import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Phone, 
  Video, 
  Info, 
  Search, 
  MoreHorizontal, 
  MessageCircle, 
  Users, 
  Settings,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  phone: string;
  name: string;
  avatar: string;
}

interface Message {
  sender_phone: string;
  receiver_phone: string;
  content: string;
  timestamp: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket Setup
  useEffect(() => {
    if (user) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}`);
      
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', phone: user.phone }));
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
          setMessages(prev => [...prev, {
            sender_phone: data.sender,
            receiver_phone: user.phone,
            content: data.content,
            timestamp: data.timestamp
          }]);
        }
      };

      setWs(socket);
      fetchContacts();

      return () => socket.close();
    }
  }, [user]);

  const fetchContacts = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setContacts(data.filter((c: User) => c.phone !== user?.phone));
  };

  const fetchMessages = async (contactPhone: string) => {
    if (!user) return;
    const res = await fetch(`/api/messages/${user.phone}/${contactPhone}`);
    const data = await res.json();
    setMessages(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneInput.length < 10) return;
    
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput })
      });
      const data = await res.json();
      if (data.success) {
        setIsVerifying(true);
        if (data.mode === 'simulated') {
          alert('ডেমো মোড: আসল SMS পাঠানো হয়নি। লগইন করতে যেকোনো ৬টি সংখ্যা (যেমন: 123456) ব্যবহার করুন।');
        }
      } else {
        alert('OTP পাঠাতে সমস্যা হয়েছে: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, code: otp })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        alert('ভুল ওটিপি (OTP)! আবার চেষ্টা করুন।');
      }
    } catch (error) {
      alert('ভেরিফিকেশনে সমস্যা হয়েছে।');
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedContact || !ws || !user) return;

    const msg = {
      type: 'chat',
      sender: user.phone,
      receiver: selectedContact.phone,
      content: newMessage
    };

    ws.send(JSON.stringify(msg));
    
    setMessages(prev => [...prev, {
      sender_phone: user.phone,
      receiver_phone: selectedContact.phone,
      content: newMessage,
      timestamp: new Date().toISOString()
    }]);
    
    setNewMessage('');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <MessageCircle className="text-white w-10 h-10" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            {isVerifying ? 'কোডটি দিন' : 'মেসেঞ্জারে স্বাগতম'}
          </h1>
          <p className="text-slate-500 text-center mb-8">
            {isVerifying 
              ? `${phoneInput} নম্বরে একটি কোড পাঠানো হয়েছে` 
              : 'চালিয়ে যেতে আপনার ফোন নম্বরটি দিন'}
          </p>

          {!isVerifying ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">+880</span>
                <input 
                  type="tel" 
                  placeholder="ফোন নম্বর" 
                  className="w-full pl-16 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                পরবর্তী
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <input 
                type="text" 
                placeholder="৬ ডিজিটের কোড (যেমন: ১২৩৪৫৬)" 
                className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center tracking-[1em] font-bold"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                ভেরিফাই করুন
              </button>
              <button 
                type="button"
                onClick={() => setIsVerifying(false)}
                className="w-full text-slate-500 py-2 text-sm font-medium"
              >
                নম্বর পরিবর্তন করুন
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">চ্যাটস</h1>
          <div className="flex gap-2">
            <div className="p-2 bg-slate-100 rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="সার্চ করুন" 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {contacts.map((contact) => (
            <div 
              key={contact.phone}
              onClick={() => {
                setSelectedContact(contact);
                fetchMessages(contact.phone);
              }}
              className={`flex items-center gap-3 p-3 mx-2 rounded-xl cursor-pointer transition-colors ${selectedContact?.phone === contact.phone ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className="relative">
                <img src={contact.avatar} alt={contact.name} className="w-14 h-14 rounded-full bg-slate-200" referrerPolicy="no-referrer" />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-slate-900 truncate">{contact.name}</h3>
                  <span className="text-xs text-slate-400">12:45 PM</span>
                </div>
                <p className="text-sm text-slate-500 truncate">মেসেজটি দেখতে এখানে ক্লিক করুন</p>
              </div>
            </div>
          ))}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center gap-3">
          <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-slate-200" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.phone}</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-white ${!selectedContact ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-bottom border-slate-100 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedContact(null)} className="md:hidden p-2 hover:bg-slate-100 rounded-full">
                  <ArrowLeft className="w-6 h-6 text-blue-600" />
                </button>
                <div className="relative">
                  <img src={selectedContact.avatar} alt={selectedContact.name} className="w-10 h-10 rounded-full bg-slate-200" referrerPolicy="no-referrer" />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{selectedContact.name}</h3>
                  <p className="text-xs text-green-500 font-medium">সক্রিয় আছেন</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
              <div className="flex flex-col items-center mb-8">
                <img src={selectedContact.avatar} alt={selectedContact.name} className="w-24 h-24 rounded-full mb-3 bg-slate-200" referrerPolicy="no-referrer" />
                <h2 className="text-xl font-bold text-slate-900">{selectedContact.name}</h2>
                <p className="text-sm text-slate-500">আপনারা এখন মেসেঞ্জারে কানেক্টেড</p>
              </div>

              {messages.map((msg, idx) => {
                const isMe = msg.sender_phone === user.phone;
                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-slate-100 text-slate-900 rounded-bl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-full">
                  <MoreHorizontal className="w-6 h-6" />
                </button>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="মেসেজ লিখুন..." 
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                </div>
                <button 
                  onClick={sendMessage}
                  className={`p-2 rounded-full transition-colors ${newMessage.trim() ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300'}`}
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">আপনার চ্যাট শুরু করুন</h2>
              <p className="text-slate-500">বাম পাশের লিস্ট থেকে কাউকে সিলেক্ট করুন</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
