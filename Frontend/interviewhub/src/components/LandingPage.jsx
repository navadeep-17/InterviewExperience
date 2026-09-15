import { User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-5 sm:px-8 lg:px-12 pb-12">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center gap-4 py-6 sm:py-8 border-b border-slate-200">
        <span
          className="text-2xl sm:text-3xl font-bold text-indigo-700 tracking-tight"
        >
          RoundRelay
        </span>
        <button
          className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
          onClick={() => navigate("/login")}
          aria-label="Sign In / Sign Up"
        >
          <User2 className="shrink-0" size={20} />
          <span>Sign in</span>
        </button>
      </header>

      {/* Hero/About */}
      <section className="max-w-3xl mx-auto text-center py-16 sm:py-24 animate-fade-in">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-slate-900 mb-6">
          Real interview experiences, passed forward.
        </h1>
        <p className="text-base sm:text-lg leading-relaxed text-slate-600 mb-8">
          RoundRelay is a peer-driven platform where students share real interview journeys, learn from peers and seniors, and pass useful knowledge forward to prepare for interviews and placements.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-200">Community Driven</span>
          <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-200">Peer Shared</span>
          <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-100">For Students, By Students</span>
        </div>
      </section>

      {/* Success Stories */}
      <section className="max-w-6xl mx-auto mb-16 sm:mb-20 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Success Stories</h2>
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
      <section className="bg-white border border-slate-200 rounded-2xl max-w-6xl mx-auto p-6 sm:p-10 mb-16 sm:mb-20 shadow-sm animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">What Our Users Say</h2>
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
      <section className="max-w-4xl mx-auto pt-4 pb-12 text-center border-b border-slate-200 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Our Mission</h2>
        <p className="text-lg text-slate-600 mb-4">
          Empower every student to prepare confidently for interviews by learning from real, peer-shared experiences.
        </p>
        <ul className="flex flex-wrap justify-center gap-4 mt-4">
          <li className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-100">Transparency</li>
          <li className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-100">Support</li>
          <li className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:bg-indigo-200">Growth</li>
        </ul>
      </section>

      {/* Animations */}
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(30px);}
            to { opacity: 1; transform: translateY(0);}
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out both;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-fade-in { animation: none; }
          }
        `}
      </style>
    </div>
  );
}

function StoryCard({ title, desc, author, date }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-2 border border-slate-200 transition-shadow duration-200 hover:shadow-md">
      <h3 className="font-bold text-lg text-slate-900">{title}</h3>
      <p className="text-slate-600 text-sm flex-1">{desc}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-indigo-700 font-semibold text-sm">by {author}</span>
        <span className="text-slate-500 text-xs">{date}</span>
      </div>
    </div>
  );
}

function FeedbackCard({ text, user }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex-1 text-slate-600 transition-shadow duration-200 hover:shadow-md">
      <p className="mb-4">&quot;{text}&quot;</p>
      <div className="text-indigo-700 font-semibold text-right">– {user}</div>
    </div>
  );
}