import React, { useCallback, useEffect, useState } from 'react';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

const defaultFormData = {
    workPhone: '',
    subject: '',
    message: '',
    lastName: '',
    howMuchDoYouEnjoyEatingPie: '',
    howDidYouHearAboutThisJobPosting: [],
    homePhone: '',
    firstName: '',
    email: '',
    department: '',
    companyName: '',
    cellPhone: '',
    appointmentDate: '',
    acceptTerms: '',
};

const defaultFormProperties = {
    csrf: {
        name: '',
        token: '',
    },
    hash: '',
    honeypot: {
        name: '',
        value: '',
    },
    freeform_payload: '',
    reCaptcha: {
        enabled: false,
        handle: '',
        name: '',
    },
    loadingText: '',
    successMessage: '',
    errorMessage: '',
};

const RECAPTCHA_SITE_KEY = '6Lce6nQmAAAAAO5d4LWC6TkECxNRSG7WNiVj17B1';

async function getFormProperties(formId) {
  // See https://docs.solspace.com/craft/freeform/v4/developer/graphql/#how-to-render-a-form
  const response = await fetch(`/freeform/form/properties/${formId}`, { headers: { 'Accept': 'application/json' }});

  if (!response.ok) {
    throw new Error('Failed to fetch Craft Freeform Form properties');
  }

  return response.json();
}

async function saveQuoteSubmission(params) {
    const { reCaptchaValue, formData, formProperties } = params;
    const { csrf, hash, honeypot, freeform_payload, reCaptcha } = formProperties;

    const body = new FormData();
    body.append(csrf.name, csrf.token);
    body.append(honeypot.name, honeypot.value);

    body.append('formHash', hash);
    body.append('freeform_payload', freeform_payload);
    body.append(reCaptcha.name, reCaptchaValue);

    body.append('firstName', formData.firstName);
    body.append('lastName', formData.lastName);
    body.append('companyName', formData.companyName);
    body.append('email', formData.email);
    body.append('cellPhone', formData.cellPhone);
    body.append('homePhone', formData.homePhone);
    body.append('workPhone', formData.workPhone);
    body.append('subject', formData.subject);
    body.append('appointmentDate', formData.appointmentDate);
    body.append('department', formData.department);
    body.append('howMuchDoYouEnjoyEatingPie', formData.howMuchDoYouEnjoyEatingPie);
    body.append('message', formData.message);

    for (let i = 0; i < formData.howDidYouHearAboutThisJobPosting.length; i++) {
        body.append('howDidYouHearAboutThisJobPosting[]', formData.howDidYouHearAboutThisJobPosting[i]);
    }

    body.append('acceptTerms', formData.acceptTerms);

    const response = await fetch('/actions/freeform/submit', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': csrf.token,
            'Cache-Control': 'no-cache',
            'X-Requested-With': 'XMLHttpRequest',
            'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest',
            'X-Craft-Solspace-Freeform-Mode': 'Headless',
        },
        body,
    });

    if (!response.ok) {
        throw new Error('Failed to submit Craft Freeform Form');
    }

    return response.json();
}

const Form = () => {
    const { executeRecaptcha } = useGoogleReCaptcha();

    const [formData, setFormData] = useState(defaultFormData);
    const [reCaptchaValue, setReCaptchaValue] = useState('');
    const [formProperties, setFormProperties] = useState(defaultFormProperties);

    const errorMessage = document.querySelector('#errorMessage');
    const successMessage = document.querySelector('#successMessage');
    const submitButton = document.querySelector('button[type="submit"]');

    const startProcessing = () => {
        submitButton.style.cursor = 'not-allowed';
        submitButton.innerText = formProperties.loadingText;
    };

    const stopProcessing = () => {
        submitButton.innerText = 'Submit';
        submitButton.style.cursor = 'pointer';
    };

    const showSubmissionSuccess = () => {
        successMessage.style.display = 'block';
        scrollToTop();
    };

    const hideSubmissionSuccess = () => {
        successMessage.style.display = 'none';
    };

    const showSubmissionError = () => {
        errorMessage.style.display = 'block';
        scrollToTop();
    };

    const hideSubmissionError = () => {
        errorMessage.style.display = 'none';

        const errors = document.querySelectorAll('.error-message');
        if (errors) {
            errors.forEach(error => {
                error.classList.remove('flex');
                error.classList.add('hidden');
            });
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleReCaptchaVerify = useCallback(async () => {
        if (!executeRecaptcha) {
            return;
        }

        const token = await executeRecaptcha();
        setReCaptchaValue(token);
    }, [executeRecaptcha]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        hideSubmissionError();
        hideSubmissionSuccess();
        startProcessing();

        handleReCaptchaVerify().then(async () => {
            const response = await saveQuoteSubmission({ reCaptchaValue, formData, formProperties });

            if (response && response.success) {
                showSubmissionSuccess();
            } else if (response && response.errors) {
                showSubmissionError();

                for (const [key, value] of Object.entries(response.errors)) {
                    const element = document.querySelector(`.${key}-field .error-message`);
                    if (element) {
                        element.innerHTML = value[0];
                        element.classList.add('flex');
                        element.classList.remove('hidden');
                    }
                }
            }

            stopProcessing();
            event.target.reset();
        });
    };

    const handleHowDidYouHearAboutThisJobPosting = (event) => {
        let howDidYouHearAboutThisJobPosting = [...formData.howDidYouHearAboutThisJobPosting];

        if (event.target.checked) {
            howDidYouHearAboutThisJobPosting.push(event.target.value);
        } else {
            howDidYouHearAboutThisJobPosting = howDidYouHearAboutThisJobPosting.filter((value) => value !== event.target.value);
        }

        setFormData({
            ...formData,
            howDidYouHearAboutThisJobPosting,
        });
    };

    useEffect(() => {
        handleReCaptchaVerify().then();
    }, [handleReCaptchaVerify]);

    /**
     * Note the ignore variable which is initialized to false, and is set to true during cleanup.
     * This ensures your code doesn't suffer from "race conditions": network responses may arrive in a different order than you sent them.
     */
    useEffect(() => {
        let ignore = false;

        // Set your Freeform Form ID from Craft.
        const formId = 4;

        getFormProperties(formId).then(formProperties => {
            if (!ignore) {
                setFormProperties(formProperties);
            }
        });

        return () => {
            ignore = true;
        };
    }, []);

    return (
        <form className="text-center flex flex-col items-left justify-left" onSubmit={handleSubmit}>
            <h3 className="mb-4 text-xl font-normal text-left">Quote Form</h3>
            <div id="successMessage" className="w-full bg-green-100 border border-green-400 text-sm text-left text-green-700 px-4 py-2 rounded-md mb-8" style={{ display: 'none' }}>
                <p>{formProperties.successMessage}</p>
            </div>
            <div id="errorMessage" className="w-full bg-red-100 border border-red-400 text-sm text-left text-red-700 px-4 py-2 rounded-md mb-8" style={{ display: 'none' }}>
                <p>{formProperties.errorMessage}</p>
            </div>
            <div className="flex flex-col w-full space-y-3">
                <div className="form-row">
                    <div className="field-wrapper firstName-field">
                        <label htmlFor="firstName">First Name <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="firstName" type="text" id="firstName" value={formData.firstName} onChange={event => setFormData({ ...formData, firstName: event.target.value })} />
                        <span className="field-error error-message hidden"></span>
                    </div>
                    <div className="field-wrapper lastName-field">
                        <label htmlFor="lastName">Last Name <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="lastName" type="text" id="lastName" value={formData.lastName} onChange={event => setFormData({ ...formData, lastName: event.target.value })} />
                        <span className="field-error error-message hidden"></span>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="companyName">Organization Name</label>
                        <input className="form-input field-input" name="companyName" type="text" id="companyName" value={formData.companyName} onChange={event => setFormData({ ...formData, companyName: event.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper email-field">
                        <label htmlFor="email">Email <span className="ml-1 text-[red]">*</span></label>
                        <div className="text-sm text-slate-400">We&apos;ll never share your email with anyone else.</div>
                        <input className="form-input field-input" name="email" type="email" id="email" value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} />
                        <span className="field-error error-message hidden"></span>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper cellPhone-field">
                        <label htmlFor="cellPhone">Cell Phone <span className="ml-1 text-[red]">*</span></label>
                        <input className="form-input field-input" name="cellPhone" type="tel" id="cellPhone" value={formData.cellPhone} onChange={event => setFormData({ ...formData, cellPhone: event.target.value })} />
                        <span className="field-error error-message hidden"></span>
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="homePhone">Home Phone</label>
                        <input className="form-input field-input" name="homePhone" type="tel" id="homePhone" value={formData.homePhone} onChange={event => setFormData({ ...formData, homePhone: event.target.value })} />
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="workPhone">Work Phone</label>
                        <input className="form-input field-input" name="workPhone" type="tel" id="workPhone" value={formData.workPhone} onChange={event => setFormData({ ...formData, workPhone: event.target.value })} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper subject-field">
                        <label htmlFor="subject">Subject <span className="ml-1 text-[red]">*</span></label>
                        <select className="form-select field-input" name="subject" id="subject" value={formData.subject} onChange={event => setFormData({ ...formData, subject: event.target.value })}>
                            <option value="">I need some help with...</option>
                            <option value="myHomework">My homework</option>
                            <option value="practicingMyHammerDance">Practicing my hammer dance</option>
                            <option value="findingMyBellyButton">Finding my belly button</option>
                        </select>
                        <span className="field-error error-message hidden"></span>
                    </div>
                    <div className="field-wrapper">
                        <label htmlFor="appointmentDate">Appointment Date</label>
                        <input className="form-input field-input" name="appointmentDate" type="text" id="appointmentDate" placeholder="YYYY/MM/DD" autoComplete="off" value={formData.appointmentDate} onChange={event => setFormData({ ...formData, appointmentDate: event.target.value })} />
                    </div>
                    <div className="field-wrapper department-field">
                        <label htmlFor="department">Department <span className="ml-1 text-[red]">*</span></label>
                        <select className="form-select field-input" name="department" id="department" value={formData.department} onChange={event => setFormData({ ...formData, department: event.target.value })}>
                            <option value="">Please choose...</option>
                            <option value="sales@example.com">Sales</option>
                            <option value="service@example.com">Service</option>
                            <option value="support@example.com">Support</option>
                        </select>
                        <span className="field-error error-message hidden"></span>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="howMuchDoYouEnjoyEatingPie-1" className="flex flex-row">How much do you enjoy eating pie?</label>
                        <div className="flex flex-row space-x-4">
                            <label htmlFor="howMuchDoYouEnjoyEatingPie-1" className="flex flex-row items-center justify-center">
                                <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id="howMuchDoYouEnjoyEatingPie-1" value="1" onChange={event => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> 1
                            </label>
                            <label htmlFor="howMuchDoYouEnjoyEatingPie-2" className="flex flex-row items-center justify-center">
                                <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id="howMuchDoYouEnjoyEatingPie-2" value="2" onChange={event => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> 2
                            </label>
                            <label htmlFor="howMuchDoYouEnjoyEatingPie-3" className="flex flex-row items-center justify-center">
                                <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id="howMuchDoYouEnjoyEatingPie-3" value="3" onChange={event => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> 3
                            </label>
                            <label htmlFor="howMuchDoYouEnjoyEatingPie-4" className="flex flex-row items-center justify-center">
                                <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id="howMuchDoYouEnjoyEatingPie-4" value="4" onChange={event => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> 4
                            </label>
                            <label htmlFor="howMuchDoYouEnjoyEatingPie-5" className="flex flex-row items-center justify-center">
                                <input className="field-input-radio" name="howMuchDoYouEnjoyEatingPie" type="radio" id="howMuchDoYouEnjoyEatingPie-5" value="5" onChange={event => setFormData({ ...formData, howMuchDoYouEnjoyEatingPie: event.target.value })} /> 5
                            </label>
                        </div>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper message-field">
                        <label htmlFor="message">Message <span className="ml-1 text-[red]">*</span></label>
                        <textarea className="form-textarea field-input" name="message" id="message" rows={5} value={formData.message} onChange={event => setFormData({ ...formData, message: event.target.value })}></textarea>
                        <span className="field-error error-message hidden"></span>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper">
                        <label htmlFor="howDidYouHearAboutThisJobPosting-Newspaper">How did you hear about us?</label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Newspaper" value="Newspaper" onChange={handleHowDidYouHearAboutThisJobPosting} /> Newspaper
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Radio" value="Radio" onChange={handleHowDidYouHearAboutThisJobPosting} /> Radio
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-CarrierPigeon" value="Carrier Pigeon" onChange={handleHowDidYouHearAboutThisJobPosting} /> Carrier Pigeon
                        </label>
                        <label className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="howDidYouHearAboutThisJobPosting[]" type="checkbox" id="howDidYouHearAboutThisJobPosting-Other" value="Other" onChange={handleHowDidYouHearAboutThisJobPosting} /> Other
                        </label>
                    </div>
                </div>
                <div className="form-row">
                    <div className="field-wrapper acceptTerms-field">
                        <label htmlFor="acceptTerms" className="flex flex-row items-center justify-center">
                            <input className="field-input-checkbox" name="acceptTerms" type="checkbox" id="acceptTerms" value="yes" onChange={event => setFormData({ ...formData, acceptTerms: event.target.checked ? event.target.value : '' })} />
                            I agree to the <a href="https://solspace.com" className="mx-1 underline">terms &amp; conditions</a> required by this site. <span className="ml-1 text-[red]">*</span>
                        </label>
                        <span className="field-error error-message hidden"></span>
                    </div>
                </div>
                <div className="form-row">
                    <div className="flex flex-row items-left justify-left space-y-2 w-full">
                        <button className="btn-primary" type="submit">Submit</button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default function QuoteForm() {
    return (
        <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY}>
            <Form />
        </GoogleReCaptchaProvider>
    );
};
