import React, { useState, useEffect } from 'react'
import Navbar from '../components/Navbar'
import HeroHeader from '../components/HeroHeader'
import LogoCloud from '../components/LogoCloud'
import HowItWorks from '../components/HowItWorks'
import FeaturesList from '../components/FeaturesList'
import DetailedShowcase from '../components/DetailedShowcase'
import Pricing from '../components/Pricing'
import Testimonials from '../components/Testimonials'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem("vish_jwt");

  const handleAuth = () => {
    if (localStorage.getItem("vish_jwt")) {
      navigate('/admin/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{ padding: '0', backgroundColor: 'white', minHeight: '100vh' }}>
      <Navbar onSignIn={handleAuth} isLoggedIn={isLoggedIn} />
      <main>
        <HeroHeader onStart={handleAuth} isLoggedIn={isLoggedIn} />
        <LogoCloud />
        <HowItWorks />
        <FeaturesList />
        <DetailedShowcase />
        <Pricing onStart={handleAuth} isLoggedIn={isLoggedIn} />
        <Testimonials />
        <FinalCTA onStart={handleAuth} isLoggedIn={isLoggedIn} />
      </main>
      <Footer />
    </div>
  );
}
