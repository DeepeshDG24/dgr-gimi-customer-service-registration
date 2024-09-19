const { app } = require('@azure/functions');
const sql = require('mssql');
require('dotenv').config();

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

app.http('customer-registration', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        console.log('zzzzzzzzzzzzzzzzz', request)
        const { 
            firstname,
            lastname,
            phone,
            email,
            dob,
            address1,
            address2,
            city,
            state,
            zip 
        } = request.params;
        console.log('zzzzzzzzzzzzzzzzz here')
        if (!phone) {
            return { status: 400, body: JSON.stringify({ message: 'Phone number is required' })};
        }
        if (!firstname) {
            return { status: 400, body: JSON.stringify({ message: 'First name is required' })};
        }
        if (!lastname) {
            return { status: 400, body: JSON.stringify({ message: 'Last name is required' })};
        }
        console.log('zzzzzzzzzzzzzzzzz here')


            let connection;
            let transaction;

            try {
                console.log('Connecting to the database...');
                connection = await sql.connect(sqlConfig);
                console.log('Connection established.');
                transaction = new sql.Transaction(connection);

                await transaction.begin();

                // Check if phone number exists
                try {
                    const phoneQuery = `SELECT 1 FROM dbo.tblMember WHERE Mobile = @phone`;
                    const { recordset } = await connection.request()
                        .input('phone', sql.VarChar, phone)
                        .query(phoneQuery);

                    if (recordset.length > 0) {
                        await transaction.rollback();
                        return { status: 400, body: JSON.stringify({ message: 'Phone number exists', success: false }) };
                    }
                } catch (phoneCheckError) {
                    console.error('Error checking phone number', phoneCheckError);
                    await transaction.rollback();
                    return { status: 500, body: JSON.stringify({ message: 'Failed to check phone number', error: phoneCheckError.message }) };
                }

                // chceck for the next customer code
                let customerCode
                try {
                    const { recordset: custCodeSet } = await connection.request().execute('dbo.Sp_GetNextCusCode');
                    customerCode = custCodeSet[0]?.CustomerCode;
                } catch (codeFetchError) {
                    console.error('Error fetching customer code', codeFetchError);
                    await transaction.rollback();
                    return { status: 500, body: JSON.stringify({ message: 'Failed to get customer code', error: codeFetchError.message }) };
                }
                const custName = `${firstname} ${lastname}`;

                // Run the stored procedures
                const setCustomerMasterQuery = (`
                    exec dbo.[USP_SET_CUSTOMER_MASTER_NEW]
                    @CUST_CODE=N'${customerCode}',
                    @CUST_LOCATION=N'HQ',
                    @CUST_NAME=N'${custName}',
                    @CUST_CATEGORY=N'',
                    @CUST_CLASS=N'',
                    @CUST_TYPE=N'',
                    @CUST_PRICE_TYPE=N'',
                    @CUST_DOB=N'${dob}',
                    @CUST_AGE_GROUP=N'',
                    @CUST_GENDER=N'',
                    @CUST_MARITIAL_STATUS=N'',
                    @CUST_ANNIVERSARY_DATE=N'',
                    @CUST_NATIONALITY=N'',
                    @CUST_EDUCATION=N'',
                    @CUST_OCCUPATION=N'',
                    @CUST_EMPLOYER=N'',
                    @CUST_DESIGNATION=N'',
                    @CUST_CUST_REPRESENTATIVE=N'',
                    @CUST_ADDRESS1=N'${address1}',
                    @CUST_ADDRESS2=N'${address2}',
                    @CUST_ADDRESS3=N'',
                    @CUST_EMAIL=N'${email}',
                    @CUST_RES_PHONE=N'',
                    @CUST_OFF_PHONE=N'',
                    @CUST_MOBILE=N'${phone}',
                    @CUST_COUNTRY_CODE=N'',
                    @CUST_CURRENCY_CODE=N'',
                    @CUST_ZONE=N'',
                    @CUST_STATE=N'${state}',
                    @CUST_CITY=N'${city}',
                    @CUST_PIN_CODE=N'${zip}',
                    @CUST_ALLOW_DISCOUNT=0,
                    @CUST_DISCOUNT_CATEGORY=N'',
                    @CUST_DISCOUNT_PERCENTAGE=N'0',
                    @CUST_LOYALTY_CARD_NO=N'',
                    @CUST_LOYALTY_CARD_STATUS=N'',
                    @CUST_REG_DATE=N'',
                    @CUST_EXPIRY_DATE=N'',
                    @CUST_RENEWAL_DATE=N'',
                    @CUST_IDENTIFICATION_TYPE=N'',
                    @CUST_IDENTIFICATION_NUMBER=N'',
                    @CUST_LAST_SALE_DATE=N'',
                    @CUST_LAST_PAID_DATE=N'',
                    @CUST_TOTAL_SALES=N'0',
                    @CUST_TOTAL_DISCOUNT=N'0',
                    @CUST_TOTAL_REWARDS=N'0',
                    @CUST_TOTAL_REDEEMED=N'0',
                    @CUST_CREDIT_TYPE=N'',
                    @CUST_CREDIT_LIMIT=N'0',
                    @CUST_CREDIT_BALANCE=N'0',
                    @MODE=N'',
                    @USER=N'',
                    @CUST_TITLE=N'',
                    @CUST_STATUS=1,
                    @CreditAllowed=N'',
                    @MaritialStatus=N'',
                    @CUST_POINTS_AVAILABLE=1,
                    @CUST_OPENING_BALANCE=0,
                    @GSTNO=0,
                    @GSTTYPE=1,
                    @Distance=1,
                    @CountryCode=N'',
                    @AreaCode=N'',
                    @VendorCode=N'',
                    @VatRef=N'1',
                    @CUST_FIRST_NAME=N'${firstname}',
                    @CUST_LAST_NAME=N'${lastname}',
                    @TAX_EX_NUMBER=N'';
                    `);

                    try {
                        await connection.request().query(setCustomerMasterQuery);
                    } catch (masterProcError) {
                        console.error('Error executing USP_SET_CUSTOMER_MASTER_NEW', masterProcError);
                        await transaction.rollback();
                        return { status: 500, body: JSON.stringify({ message: 'Failed to execute USP_SET_CUSTOMER_MASTER_NEW', error: masterProcError.message }) };
                    }

                const setCustomerClassQuery = (`
                    exec dbo.[USP_SET_CUSTOMER_CLASS]
                    @CUST_ID=26,
                    @CUST_CODE=N'${customerCode}',
                    @CUST_FIRST_NAME=N'${firstname}',
                    @CUST_LAST_NAME=N'${lastname}',
                    @CUST_CITY=N'${city}',
                    @CUSTOMER_CLASS=N'Club Member',
                    @CUSTOMER_MOBILE=N'${phone}';
                `);

                try {
                    await connection.request().query(setCustomerClassQuery);
                } catch (classProcError) {
                    console.error('Error executing USP_SET_CUSTOMER_CLASS', classProcError);
                    await transaction.rollback();
                    return { status: 500, body: JSON.stringify({ message: 'Failed to execute USP_SET_CUSTOMER_CLASS', error: classProcError.message }) };
                }

                await transaction.commit();
                return { body: JSON.stringify({message: 'Customer added successfully', success: true}) };
            } catch (error) {
                if (transaction) {
                    await transaction.rollback();
                }
                console.error('Error executing stored procedures', error);
                throw new Error('Something went wrong.');
            } finally {
                if (connection) {
                    connection.close();
                    console.log('Connection closed.');
                }
            }
    }
});
