import Image from "next/image";

export default function TopBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-background-blur border-b">
      <div className="flex items-center justify-center h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Image 
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEg-rfInAW3hffAeQ5Eid-iGK0SVwv4acB9uD6bPYkmA8jY4aKMu283s8xhbqCMUP-NIIidpel_wZbi3aarpV2wk1nH-KW3eAhSRy0f6E3Kqd-4JV0W5arP1U9TR73vEoBuit8FrMHEWhOZfSpEjw6N0gGRxknNVtIVcyYS0VUx2w4Qu3VXMYZzUyf0OQJU5/s320/New%20Project%2019%20%5BE486179%5D.png" 
          alt="Blur Logo"
          width={100}
          height={32}
        />
      </div>
    </header>
  );
}
