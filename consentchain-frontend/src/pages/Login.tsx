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
                (window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`)
              }
              className="flex items-center gap-3 !bg-white text-black font-medium px-6 py-3 rounded-full shadow hover:bg-gray-200 transition"
            >
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
</svg>
              Sign in
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
