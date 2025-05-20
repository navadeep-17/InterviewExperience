import { User2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./A";

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-6">
        <span
          className="text-4xl md:text-5xl font-extrabold text-indigo-600 tracking-tight relative cursor-pointer transition-all duration-300
            after:content-[''] after:block after:h-0.5 after:bg-pink-400 after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300 after:origin-left"
        >
          CareerStories
        </span>
        <button
          className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center border border-indigo-100 hover:bg-indigo-50 transition-transform duration-200 hover:scale-110"
          onClick={() => navigate("/login")}
          aria-label="Sign In / Sign Up"
        >
          <User2 className="text-indigo-500" size={38} />
        </button>
      </header>

      {/* Hero/About */}
      <section className="max-w-3xl mx-auto text-center mt-16 mb-20 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-6 transition-all duration-700 hover:text-indigo-600">
          Share & Discover Real Interview Experiences
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          CareerStories is a platform where students share their interview journeys, learn from peers, and get inspired to achieve their dream jobs.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <span className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-200">Community Driven</span>
          <span className="px-4 py-2 bg-pink-100 text-pink-500 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-pink-200">Verified Stories</span>
          <span className="px-4 py-2 bg-indigo-50 text-indigo-400 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-100">For Students, By Students</span>
        </div>
      </section>

      {/* Success Stories */}
      <section className="max-w-5xl mx-auto mb-20 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Recent Success Stories</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StoryCard
            title="Google SDE Intern"
            desc="3 rounds of DS & Algo, system design, and behavioral. Focus on problem-solving and clarity."
            author="Ananya"
            date="2 days ago"
          />
          <StoryCard
            title="Amazon SDE 1"
            desc="Online assessment, technical interviews, and leadership principles. Practice coding and STAR method."
            author="Rahul M."
            date="5 days ago"
          />
          <StoryCard
            title="Microsoft Explore"
            desc="Group exercise, technical round, and project discussion. Collaboration and fundamentals matter."
            author="Shruti K."
            date="1 week ago"
          />
        </div>
      </section>

      {/* User Feedback */}
      <section className="bg-white/70 backdrop-blur rounded-3xl max-w-5xl mx-auto py-12 px-6 mb-20 shadow animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-8 text-center">What Our Users Say</h2>
        <div className="flex flex-col md:flex-row gap-8 justify-center">
          <FeedbackCard
            text="Helped me crack my Amazon SDE interview! Great insights from past experiences."
            user="Rahul M."
          />
          <FeedbackCard
            text="A must-have resource for students. The platform is so clean and easy to use."
            user="Shruti K."
          />
        </div>
      </section>

      {/* Goals & Aims */}
      <section className="max-w-4xl mx-auto mb-24 text-center animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Our Mission</h2>
        <p className="text-lg text-slate-600 mb-4">
          Empower every student to prepare confidently for interviews by learning from real, verified experiences.
        </p>
        <ul className="flex flex-wrap justify-center gap-4 mt-4">
          <li className="bg-indigo-50 text-indigo-500 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-100">Transparency</li>
          <li className="bg-pink-50 text-pink-400 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-pink-100">Support</li>
          <li className="bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-200">Growth</li>
        </ul>
      </section>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[3px] transition">
          <div className="absolute inset-0" onClick={() => setShowAuth(false)} />
          <div
            className="relative z-10 w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto
        bg-gradient-to-br from-white/90 via-indigo-50/80 to-blue-100/80
        backdrop-blur-2xl border border-indigo-100 shadow-2xl
        rounded-3xl p-2 sm:p-4 md:p-8 flex flex-col items-center
        transition-all duration-300 animate-modal-in"
            role="dialog"
            aria-modal="true"
            style={{ animation: "modal-in 0.3s forwards" }}
          >
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 text-3xl font-bold transition-transform duration-200 hover:scale-125"
              onClick={() => setShowAuth(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="w-full flex flex-col items-center">
              <AuthForm />
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(30px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fade-in {
            animation: fade-in 0.8s cubic-bezier(.4,0,.2,1) both;
          }
          @keyframes modal-in {
            from { opacity: 0; transform: scale(0.95);}
            to { opacity: 1; transform: scale(1);}
          }
          .animate-modal-in {
            animation: modal-in 0.3s cubic-bezier(.4,0,.2,1) forwards;
          }
        `}
      </style>
    </div>
  );
}

function StoryCard({ title, desc, author, date }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-2 border border-slate-100 transition-transform duration-300 hover:scale-105 hover:shadow-2xl">
      <h3 className="font-bold text-lg text-slate-800">{title}</h3>
      <p className="text-slate-600 text-sm flex-1">{desc}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-indigo-600 font-semibold text-sm">by {author}</span>
        <span className="text-slate-400 text-xs">{date}</span>
      </div>
    </div>
  );
}

function FeedbackCard({ text, user }) {
  return (
    <div className="bg-indigo-50 rounded-xl p-6 shadow flex-1 text-slate-700 transition-transform duration-300 hover:scale-105 hover:shadow-xl">
      <p className="mb-4">&quot;{text}&quot;</p>
      <div className="text-indigo-600 font-semibold text-right">– {user}</div>
    </div>
  );
}