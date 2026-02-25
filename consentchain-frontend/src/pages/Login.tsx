import "../styles/background.css";

function Login() {
  return (
    <>
      <div className="absolute w-full justify-center top-15 right-2.5 flex items-center gap-2 z-50">
        {/* Logo Icon */}
        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shadow-md">
          CC
        </div>

        {/* Logo Text */}
        <span className="text-white tracking wide font-clash text-xl font-medium tracking-wide">
          Consent<span className="text-white/60 px-0.5">Chain</span>
        </span>
      </div>

      <div className="w-screen h-screen flex items-center justify-center bg-transparent px-4">
        <div className="min-w-[1050px] bg-gradient-to-t from-[#171717] to-[#303030] border border-gray-500 rounded-3xl p-10 shadow-2xl min-h-[500px] flex justify-center items-center">
          <div className="w-full min-w-[1050px] bg-gradient-to-t from-[#000000] to-[#181818] border border-[#1b1b1b] rounded-3xl p-5 shadow-2xl flex flex-col justify-center items-center gap-14 min-h-[400px] text-center">
            {/* Title & Subtitle */}
            <div className="space-y-2">
              <h1 className="text-[70px] !text-[62px] font-clash tracking-wide !font-semibold leading-tight text-white py-[20px]">
                Your data.
                <span className="text-gray-300">Your rules.</span>
              </h1>
              <p className="text-lg tracking-wide text-[21px] font-clash font-normal text-gray-400 min-w-[800px] leading-tight">
                Seamlessly share and control access with confidence on
                <br />
                <span className="mx-[-10px] text-white text-[27px] font-medium">
                  ConsentChain
                </span>
                .
              </p>
            </div>

            {/* Google Sign In Button */}
            <button
              onClick={() =>
                (window.location.href = "http://localhost:3000/auth/google")
              }
              className="flex items-center gap-3 !bg-white text-black font-medium px-6 py-3 rounded-full shadow hover:bg-gray-200 transition"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Sign in
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
