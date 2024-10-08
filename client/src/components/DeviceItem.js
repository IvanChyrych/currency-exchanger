import React, { useState, useEffect } from 'react';
import { Card, Col } from "react-bootstrap";
import Image from "react-bootstrap/Image";
// import star from '../assets/star.png'
import { useHistory } from "react-router-dom"
import { DEVICE_ROUTE } from "../utils/consts";
import { fetchExrates } from "../http/exratesAPi";
import { Context } from "../index";


const DeviceItem = ({ device }) => {

    const [exrate, setTypes] = useState({ info: [] })

    // const { exrate } = useContext(Context)

    useEffect(() => {
        fetchExrates().then(data => setTypes(data))
        // console.log(data);
    }, [])

    const history = useHistory()
    return (
        <Col md={3} className={"mt-3"} onClick={() => history.push(DEVICE_ROUTE + '/' + device.id)}>
            <Card style={{ border: '1px solid lightgray', width: 160, cursor: 'pointer' }}>
                <Image width={150} height={150} src={process.env.REACT_APP_API_URL + device.img} /><br />
                <div style={{ width: '90%', margin: '0 auto', textalign: 'center' }}>{device.name}<br />
                    цена: {exrate.CDBank} руб.</div>
                <h2>{exrate.Cur_Name}  123

                    {/* {exrate.info.map(() =>
                        console.log(exrate)
                    )} */}

                </h2>
            </Card>
        </Col>
    );
};

export default DeviceItem;
